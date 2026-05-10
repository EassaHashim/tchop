import { scrapeUrl } from "../services/firecrawl";
import { createArticleCard, AuthenticationError } from "../services/graphapi";
import { claimAndCheck } from "../pipeline/dedup";
import { buildCard } from "../pipeline/mapper";
import { updateIntegrationState, supabaseClient } from "../services/supabase";
import { notifyError, notifyAuthFailure } from "../services/slack";
import type { Integration, ExtractedContent } from "../types";

export async function executeScrape(integration: Integration): Promise<void> {
  const { id, source_url, channel_id, mix_id } = integration;

  let content: ExtractedContent;
  try {
    content = await scrapeUrl(source_url);
  } catch (err: any) {
    console.error(`[scrape] Integration ${id} failed:`, err.message);
    await updateIntegrationState(id, {
      last_run_at: new Date().toISOString(),
      last_error: err.message,
    });
    await notifyError(integration, `Scrape failed: ${err.message}`);
    return;
  }

  // Change detection: compare against last known content
  const hasChanged = await detectChange(id, content);
  if (!hasChanged) {
    await updateIntegrationState(id, {
      last_run_at: new Date().toISOString(),
      last_error: null,
    });
    console.log(`[scrape] Integration ${id}: no changes detected`);
    return;
  }

  // Atomic dedup claim
  const claimed = await claimAndCheck(id, content.url);
  if (!claimed) {
    await updateIntegrationState(id, {
      last_run_at: new Date().toISOString(),
      items_found: integration.items_found + 1,
      last_error: null,
    });
    return;
  }

  const card = buildCard(integration, content);

  try {
    await createArticleCard(mix_id, card);

    // Store content + update state in parallel (independent writes)
    await Promise.all([
      storeLastContent(id, content),
      updateIntegrationState(id, {
        last_run_at: new Date().toISOString(),
        items_found: integration.items_found + 1,
        items_posted: integration.items_posted + 1,
        last_error: null,
      }),
    ]);

    console.log(`[scrape] Integration ${id}: new content posted`);
  } catch (err: any) {
    if (err instanceof AuthenticationError) {
      await updateIntegrationState(id, { last_error: "auth_error", is_active: false });
      await notifyAuthFailure(integration);
      throw err;
    }
    console.error(`[scrape] Failed to post card:`, err.message);
    await updateIntegrationState(id, {
      last_run_at: new Date().toISOString(),
      last_error: err.message,
    });
    await notifyError(integration, err.message);
  }
}

async function detectChange(integrationId: number, content: ExtractedContent): Promise<boolean> {
  const { data } = await supabaseClient
    .from("scraper_last_content")
    .select("title, description, image")
    .eq("integration_id", integrationId)
    .limit(1)
    .single();

  if (!data) return true; // First run, always process

  return (
    data.title !== content.title ||
    data.description !== content.description ||
    data.image !== content.image
  );
}

async function storeLastContent(integrationId: number, content: ExtractedContent): Promise<void> {
  await supabaseClient.from("scraper_last_content").upsert(
    {
      integration_id: integrationId,
      title: content.title,
      description: content.description,
      image: content.image,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "integration_id" }
  );
}
