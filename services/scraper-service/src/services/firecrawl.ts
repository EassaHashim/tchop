import FirecrawlApp from "@mendable/firecrawl-js";
import { config } from "../config";
import type { ExtractedContent } from "../types";
import { discoverUrlsViaApify, isApifyConfigured, deriveUrlPattern } from "./apify";

const firecrawl = new FirecrawlApp({ apiKey: config.firecrawl.apiKey });

/**
 * Discover URLs from a page using the /map endpoint.
 * Pass the actual section URL (e.g. spiegel.de/politik/), not the domain.
 * Returns URLs with basic metadata (title, description) but no full content.
 * Much faster and cheaper than crawl.
 */
export async function discoverUrls(
  sourceUrl: string,
  limit: number,
  searchTerms?: string | null
): Promise<ExtractedContent[]> {
  const mapOptions: Record<string, unknown> = { limit };
  if (searchTerms) mapOptions.search = searchTerms;

  const result = await firecrawl.map(sourceUrl, mapOptions as any);

  const links = result.links || [];

  // Detect common title suffix (e.g., "- DER SPIEGEL") across discovered titles
  const commonSuffix = detectCommonTitleSuffix(links);

  return links.map((link: any): ExtractedContent => {
    if (typeof link === "string") {
      return { url: link, title: titleFromUrl(link), description: null, image: null, source: null, publishedDate: null, markdown: null, author: null };
    }
    const url = link.url || "";
    return {
      url,
      title: cleanTitle(link.title || null, null, commonSuffix) || titleFromUrl(url),
      description: dedup(link.description || null),
      image: null,
      source: null,
      publishedDate: null,
      markdown: null,
      author: null,
    };
  });
}

/**
 * Extract clean article content using LLM-powered extraction.
 * Returns only the article body as markdown (no nav, footer, share buttons).
 * Used for Long Post card creation. Costs more credits than scrape (token-based).
 */
export async function extractArticleContent(url: string): Promise<ExtractedContent> {
  const result = await firecrawl.extract({
    urls: [url],
    prompt: "Extract the article title, the full article body as clean markdown (only the article content, no navigation, no header, no footer, no share buttons, no sidebar), and the author name if available.",
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        author: { type: "string" },
      },
      required: ["title", "body"],
    },
  });

  if (!result.success) {
    throw new Error("Extract failed");
  }

  const data = (result as any).data || {};
  return {
    url,
    title: cleanTitle(data.title || null, null),
    description: null,
    image: null,
    source: null,
    publishedDate: null,
    markdown: data.body || null,
    author: data.author || null,
  };
}

/**
 * Discover URLs with clean separation:
 * - Sample URL set -> Apify (browser rendering + URL pattern filter)
 * - No sample URL -> Firecrawl map only (with optional search terms, no fallback)
 */
export async function discoverUrlsWithFallback(
  sourceUrl: string,
  limit: number,
  searchTerms?: string | null,
  sampleUrl?: string | null
): Promise<{ items: ExtractedContent[]; usedApify: boolean }> {
  // Sample URL = Apify mode (browser rendering for JS-heavy sites)
  if (sampleUrl && isApifyConfigured()) {
    const pattern = deriveUrlPattern(sourceUrl, sampleUrl);
    console.log(`[discovery] Sample URL set, using Apify with pattern: ${pattern}`);
    const items = await discoverUrlsViaApify(sourceUrl, limit, pattern);
    // Ensure sample URL is in results (may not be on the page if it scrolled off)
    if (!items.some(i => i.url === sampleUrl)) {
      items.unshift({ url: sampleUrl, title: null, description: null, image: null, source: null, publishedDate: null, markdown: null, author: null });
    }
    return { items, usedApify: true };
  }

  // No sample URL = Firecrawl map only (no Apify fallback)
  const items = await discoverUrls(sourceUrl, limit, searchTerms);
  return { items, usedApify: false };
}

/**
 * Full scrape of a single URL. Returns complete content with images, markdown, etc.
 * 1 credit per call.
 */

export async function scrapeUrl(url: string): Promise<ExtractedContent> {
  const result = await firecrawl.scrape(url, {
    formats: ["markdown"],
  });

  return mapFirecrawlResult(result);
}

function mapFirecrawlResult(result: any): ExtractedContent {
  const metadata = result.metadata || {};
  const rawTitle = metadata.title || metadata.ogTitle || null;
  const siteName = metadata.ogSiteName || null;

  return {
    url: metadata.sourceURL || metadata.url || result.url || "",
    title: cleanTitle(rawTitle, siteName),
    description: dedup(metadata.description || metadata.ogDescription || metadata["og:description"] || null),
    image: filterImage(metadata.ogImage || metadata["og:image"] || null, metadata.favicon),
    source: siteName || null,
    publishedDate: metadata.publishedTime || metadata["article:published_time"] || null,
    markdown: result.markdown || null,
    author: metadata.author || metadata["twitter:data1"] || metadata["article:author"] || null,
  };
}

/**
 * Filter out images that are likely site logos/favicons rather than article images.
 * Returns null if the image looks like a logo so the card is created without an image.
 */
function filterImage(imageUrl: string | null, favicon: string | null): string | null {
  if (!imageUrl) return null;
  const lower = imageUrl.toLowerCase();
  // Skip favicon-like images
  if (favicon && imageUrl === favicon) return null;
  // Skip common logo/icon patterns
  if (lower.includes("favicon") || lower.includes("logo") || lower.includes("icon")
      || lower.includes("apple-touch") || lower.includes("site-logo")
      || lower.includes("brand") || lower.includes("default-og")
      || lower.includes("placeholder")) return null;
  // Skip very small images (likely icons) by checking common size indicators in URL
  if (/[\-_](\d{1,2}x\d{1,2}|16x|32x|48x|64x|72x|96x|120x|150x)/.test(lower)) return null;
  return imageUrl;
}

/**
 * Extract a readable title from a URL slug when no metadata title is available.
 * "eintracht-trainer-riera-rechnet-mit-eigener-mannschaft-ab-zr-94250023.html"
 * -> "Eintracht trainer riera rechnet mit eigener mannschaft ab"
 */
function titleFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    // Get last path segment, remove extension and ID suffixes
    const slug = pathname.split("/").filter(Boolean).pop() || "";
    const cleaned = slug
      .replace(/\.html?$/i, "")
      .replace(/-[a-z]{0,3}-?\d{6,}$/i, "") // remove "-zr-94250023" style IDs
      .replace(/-[a-f0-9]{8,}$/i, "") // remove UUID-style suffixes
      .replace(/-/g, " ");
    if (cleaned.length < 5) return null;
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  } catch {
    return null;
  }
}

// Shared separator list for title suffix detection
const TITLE_SEPARATORS = [" | ", " - ", " I ", " — ", " · ", " – "];

/**
 * Detect a common title suffix across multiple titles (batch mode for map results).
 * If 3+ titles share the same suffix after a separator, return it.
 */
function detectCommonTitleSuffix(links: any[]): string | null {
  const suffixCounts = new Map<string, number>();

  for (const link of links) {
    const title = typeof link === "string" ? null : (link.title as string | null);
    if (!title) continue;

    for (const sep of TITLE_SEPARATORS) {
      const idx = title.lastIndexOf(sep);
      if (idx > 0 && idx < title.length - sep.length) {
        const suffix = title.slice(idx);
        suffixCounts.set(suffix, (suffixCounts.get(suffix) || 0) + 1);
      }
    }
  }

  let bestSuffix: string | null = null;
  let bestCount = 0;
  for (const [suffix, count] of suffixCounts) {
    if (count >= 3 && count > bestCount) {
      bestSuffix = suffix;
      bestCount = count;
    }
  }
  return bestSuffix;
}

/**
 * Strip site name or detected suffix from a title.
 * Works in two modes:
 * - With commonSuffix (from batch detection): strip exact match
 * - With siteName (from og:site_name): strip suffix that matches the site name
 */
function cleanTitle(title: string | null, siteName: string | null, commonSuffix?: string | null): string | null {
  if (!title) return null;

  // Mode 1: strip batch-detected suffix (exact match)
  if (commonSuffix && title.endsWith(commonSuffix)) {
    return title.slice(0, -commonSuffix.length).trim();
  }

  // Mode 2: strip suffix matching site name
  if (siteName) {
    for (const sep of TITLE_SEPARATORS) {
      const idx = title.lastIndexOf(sep);
      if (idx > 0) {
        const suffix = title.slice(idx + sep.length).trim();
        if (siteName.toLowerCase().includes(suffix.toLowerCase()) ||
            suffix.toLowerCase().includes(siteName.split("™")[0]?.trim().toLowerCase() ?? "")) {
          return title.slice(0, idx).trim();
        }
      }
    }
  }

  // Mode 3: no siteName available, strip suffix that looks like a site/brand name
  if (!siteName) {
    for (const sep of TITLE_SEPARATORS) {
      const idx = title.lastIndexOf(sep);
      if (idx > 0) {
        const suffix = title.slice(idx + sep.length).trim();
        if (looksLikeSiteName(suffix)) {
          return title.slice(0, idx).trim();
        }
      }
    }
  }

  return title.trim();
}

/**
 * Heuristic: does this string look like a site/brand name rather than article text?
 * Matches: "DER SPIEGEL", "tchop.io", "CNN", "The New York Times", "ZEIT ONLINE"
 * Rejects: "ein normaler Titel", "why this matters for you"
 */
function looksLikeSiteName(s: string): boolean {
  if (s.length > 30) return false;
  const words = s.split(/\s+/);
  if (words.length > 4) return false;
  // Contains a dot (domain-like): "tchop.io", "t3n.de"
  if (s.includes(".")) return true;
  // All caps or mostly caps: "DER SPIEGEL", "CNN", "ZEIT ONLINE"
  if (s === s.toUpperCase() && s.length > 1) return true;
  // Title case with max 3 words: "The Guardian", "New York Times"
  if (words.length <= 3 && words.every(w => /^[A-Z]/.test(w))) return true;
  // Contains trademark symbols
  if (/[™®©]/.test(s)) return true;
  return false;
}

/**
 * Strip duplicated metadata values ("text., text." -> "text.")
 */
function dedup(value: string | null): string | null {
  if (!value) return null;
  const commaIdx = value.indexOf(".,");
  if (commaIdx > 0) {
    const first = value.slice(0, commaIdx + 1).trim();
    const second = value.slice(commaIdx + 2).trim();
    if (first === second) return first;
  }
  return value;
}
