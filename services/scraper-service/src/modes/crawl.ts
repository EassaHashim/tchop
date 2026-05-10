import { discoverUrlsWithFallback, scrapeUrl, extractArticleContent } from "../services/firecrawl";
import { createArticleCard, AuthenticationError } from "../services/graphapi";
import { claimAndCheck } from "../pipeline/dedup";
import { buildCard } from "../pipeline/mapper";
import { updateIntegrationState } from "../services/supabase";
import { config } from "../config";
import { notifyError, notifyAuthFailure } from "../services/slack";
import { pooled } from "../utils/async";
import type { Integration, ExtractedContent } from "../types";

export async function executeCrawl(integration: Integration): Promise<void> {
  const { id, source_url, max_pages, channel_id, mix_id } = integration;

  // Step 1: Discover URLs via /map (fast, cheap)
  // source_url is the full section URL (e.g. spiegel.de/politik/)
  let discovered: ExtractedContent[];
  let usedApify = false;
  try {
    const result = await discoverUrlsWithFallback(source_url, max_pages, integration.search_terms, integration.sample_url);
    discovered = result.items;
    usedApify = result.usedApify;
  } catch (err: any) {
    console.error(`[crawl] Integration ${id} discovery failed:`, err.message);
    await updateIntegrationState(id, {
      last_run_at: new Date().toISOString(),
      last_error: `Discovery failed: ${err.message}`,
    });
    await notifyError(integration, `Discovery failed: ${err.message}`);
    return;
  }

  console.log(`[crawl] Integration ${id}: discovered ${discovered.length} URLs`);

  // Step 2: Filter to new URLs only (dedup check BEFORE scraping)
  const newUrls: ExtractedContent[] = [];
  for (const item of discovered) {
    if (!item.url) continue;
    const claimed = await claimAndCheck(id, item.url);
    if (claimed) newUrls.push(item);
  }

  // On first run with backfill, limit to backfill count AFTER dedup
  const isFirstRun = !integration.last_run_at;
  if (isFirstRun && integration.initial_backfill > 0 && newUrls.length > integration.initial_backfill) {
    newUrls.length = integration.initial_backfill;
  }

  if (newUrls.length === 0) {
    await updateIntegrationState(id, {
      last_run_at: new Date().toISOString(),
      items_found: integration.items_found + discovered.length,
      last_error: null,
    });
    console.log(`[crawl] Integration ${id}: no new URLs`);
    return;
  }

  console.log(`[crawl] Integration ${id}: ${newUrls.length} new URL(s), scraping...`);

  // Step 3: Scrape new URLs in parallel (up to maxConcurrency), then post cards
  let posted = 0;
  const errors: string[] = [];

  const isLongPost = integration.card_type === "longpost";

  await pooled(newUrls, config.worker.maxConcurrency, async (item) => {
    let content: ExtractedContent;
    try {
      if (isLongPost) {
        // Long Post: run extract + scrape in parallel (extract for body, scrape for metadata)
        const [extracted, scraped] = await Promise.all([
          extractArticleContent(item.url),
          scrapeUrl(item.url).catch(() => null),
        ]);
        content = extracted;
        if (scraped) {
          content.image = scraped.image;
          content.source = scraped.source;
          content.description = scraped.description;
        }
      } else {
        content = await scrapeUrl(item.url);
      }
    } catch (err: any) {
      console.warn(`[crawl] Scrape/extract failed for ${item.url}, using map metadata:`, err.message);
      content = item;
    }

    const card = buildCard(integration, content);

    try {
      const result = await createArticleCard(mix_id, card);
      if (result.id !== "duplicate") posted++;
    } catch (err: any) {
      if (err instanceof AuthenticationError) {
        await updateIntegrationState(id, { last_error: "auth_error", is_active: false });
        await notifyAuthFailure(integration);
        throw err;
      }
      const errMsg = `${content.url}: ${err.message}`;
      errors.push(errMsg);
      console.error(`[crawl] Failed to post card:`, errMsg);
    }
  });

  const lastError = errors.length > 0 ? errors.join(" | ") : null;
  await updateIntegrationState(id, {
    last_run_at: new Date().toISOString(),
    items_found: integration.items_found + discovered.length,
    items_posted: integration.items_posted + posted,
    last_error: lastError,
  });

  if (lastError) await notifyError(integration, lastError);

  console.log(`[crawl] Integration ${id}: discovered ${discovered.length}, new ${newUrls.length}, posted ${posted}`);
}
