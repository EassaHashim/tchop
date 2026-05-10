import { ApifyClient } from "apify-client";
import { config } from "../config";
import type { ExtractedContent } from "../types";

const client = config.apify.token ? new ApifyClient({ token: config.apify.token }) : null;

/**
 * Derive a URL path pattern from a sample article URL.
 * Finds the common path prefix between the source URL and sample URL.
 * E.g., source "bvb.de/de/de/aktuelles/news.html" + sample "bvb.de/de/de/aktuelles/news/news.html/2026/..."
 * -> pattern "/de/de/aktuelles/news/"
 */
/**
 * Derive a URL path pattern from a sample article URL.
 * Uses the last meaningful directory segment from the sample URL's path.
 * This is more flexible than full path matching -- catches articles under
 * different regional/category prefixes (e.g., /pk/news/ and /pk/hessen/news/).
 *
 * E.g., sample "aok.de/pk/news/bewegung-im-freien/" -> "/news/"
 * E.g., sample "bild.de/sport/fussball/darmstadt-98-das..." -> "/fussball/"
 * E.g., sample "bvb.de/de/de/aktuelles/news/news.html/2026/..." -> "/news/"
 */
export function deriveUrlPattern(_sourceUrl: string, sampleUrl: string): string {
  try {
    const parts = new URL(sampleUrl).pathname.split("/").filter(Boolean);
    if (parts.length <= 1) return "/";
    // Remove the last segment (the article slug) and trailing dates/IDs/extensions
    let dirParts = parts.slice(0, -1);
    while (dirParts.length > 1) {
      const last = dirParts[dirParts.length - 1] ?? "";
      if (/^\d{1,4}$/.test(last) || last.includes(".html")) {
        dirParts = dirParts.slice(0, -1);
      } else {
        break;
      }
    }
    if (dirParts.length === 0) return "/";
    // Use just the last directory segment as the pattern -- catches regional variations
    const lastDir = dirParts[dirParts.length - 1] ?? "";
    return "/" + lastDir + "/";
  } catch {
    return "/";
  }
}

/**
 * Discover article URLs from a JS-heavy page using Apify's Web Scraper.
 * When urlPattern is provided (from sample URL), only links matching the pattern are returned.
 */
export async function discoverUrlsViaApify(
  sourceUrl: string,
  limit: number,
  urlPattern?: string | null
): Promise<ExtractedContent[]> {
  if (!client) {
    console.warn("[apify] No APIFY_TOKEN configured, skipping");
    return [];
  }

  // No depth calculation needed here -- urlPattern and skip list handle filtering

  const patternFilter = urlPattern
    ? [
      `    if (!url.includes('${urlPattern}')) return;`,
      // Skip section/navigation pages
      `    if (url.includes('startseite') || url.includes('/home-') || url.includes('/home.') || url.includes('/home/')) return;`,
      // Article URLs typically have long unique slugs -- match the sample URL's character
      `    var slug = url.split('/').filter(Boolean).pop() || '';`,
      `    if (slug.length < 20 && !slug.match(/\\d{4}/)) return;`,
    ].join("\n")
    : [
      "    var path = url.replace(/https?:\\/\\/[^/]+/, '');",
      "    if (path.split('/').filter(Boolean).length < 2) return;",
      "    if (path.length < 10) return;",
      "    var skip = ['login','register','impressum','datenschutz','agb','cookie','newsletter','abo','account','sitemap','kontakt','suche','search','gewinnspiel'];",
      "    var lower = path.toLowerCase();",
      "    for (var s of skip) { if (lower.includes(s)) return; }",
    ].join("\n");

  const pageFunction = [
    "async function pageFunction(context) {",
    "  const { jQuery: $ } = context;",
    "  await context.waitFor(5000);",
    "  var seen = new Set();",
    "  var articles = [];",
    "  var origin = '" + new URL(sourceUrl).origin + "';",
    "  $('a').each(function() {",
    "    var href = $(this).attr('href') || '';",
    "    if (!href || href === '#' || href.length < 5) return;",
    "    var url = href.startsWith('http') ? href : (href.startsWith('/') ? origin + href : origin + '/' + href);",
    "    if (seen.has(url)) return;",
    "    seen.add(url);",
    "    var title = $(this).text().trim().replace(/\\s+/g, ' ');",
    "    if (title.length < 15) return;",
    "    if (title.length > 200) title = title.substring(0, 200);",
    patternFilter,
    "    articles.push({ url: url, title: title });",
    "  });",
    "  return { articles: articles };",
    "}",
  ].join("\n");

  const mode = urlPattern ? `pattern: ${urlPattern}` : "generic filter";
  console.log(`[apify] Browser rendering for ${sourceUrl} (${mode})`);

  const run = await client.actor("apify/web-scraper").call({
    startUrls: [{ url: sourceUrl }],
    pageFunction,
    maxPagesPerCrawl: 1,
    proxyConfiguration: { useApifyProxy: true },
  }, {
    memory: 1024,
    timeout: 120,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const firstResult = items[0] as { articles?: Array<{ url: string; title: string }> } | undefined;
  const articles = firstResult?.articles || [];

  console.log(`[apify] Found ${articles.length} links via browser rendering`);

  return articles.slice(0, limit).map((a): ExtractedContent => ({
    url: a.url,
    title: a.title,
    description: null,
    image: null,
    source: null,
    publishedDate: null,
    markdown: null,
    author: null,
  }));
}

export function isApifyConfigured(): boolean {
  return !!client;
}
