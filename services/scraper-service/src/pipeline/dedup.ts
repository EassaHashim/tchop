import { claimUrl, hasProcessedArticleId } from "../services/supabase";

/**
 * Extract an article ID from a URL. Publishers often reuse the same ID
 * even when changing the URL slug (for SEO). Examples:
 * - "...koerbel-nimmt-sge-stars-in-die-pflicht-zr-94249430.html" -> "94249430"
 * - "...iran-mission-a-b6f1a23f-13df-4401-a2ad-71906c4b9d8c" -> "b6f1a23f-13df-4401-a2ad-71906c4b9d8c"
 * - "...article-12345678.html" -> "12345678"
 */
function extractArticleId(url: string): string | null {
  try {
    const path = new URL(url).pathname;

    // UUID pattern (Spiegel style): a-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuid = path.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/);
    if (uuid) return uuid[0];

    // Numeric ID at end of path (fr.de style): -zr-94249430.html or -12345678.html
    const numId = path.match(/[-_](\d{6,})(?:\.\w+)?$/);
    if (numId?.[1]) return numId[1];

    return null;
  } catch {
    return null;
  }
}

/**
 * Atomic dedup with article ID similarity check.
 * Returns true if the URL should be processed (new), false if duplicate.
 */
export async function claimAndCheck(
  integrationId: number,
  url: string
): Promise<boolean> {
  // Layer 1: exact URL dedup
  const claimed = await claimUrl(integrationId, url);
  if (!claimed) return false;

  // Layer 2: article ID dedup (catches same article with changed URL slug)
  const articleId = extractArticleId(url);
  if (articleId) {
    const alreadyProcessed = await hasProcessedArticleId(integrationId, articleId, url);
    if (alreadyProcessed) return false;
  }

  return true;
}
