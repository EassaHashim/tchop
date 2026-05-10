import { createClient } from "@supabase/supabase-js";
import { config } from "../config";
import type { Integration } from "../types";
import ms from "ms";
type StringValue = Parameters<typeof ms>[0] extends infer T ? T extends string ? T : never : never;

const client = createClient(config.supabase.url, config.supabase.key);

export async function fetchDueIntegrations(): Promise<Integration[]> {
  const { data, error } = await client
    .from("scraper_integrations")
    .select("*")
    .eq("is_active", true);

  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  if (!data) return [];

  const now = Date.now();
  return data.filter((integration: Integration) => {
    if (!integration.last_run_at) return true;
    let interval: number;
    try {
      interval = ms(integration.schedule_interval as StringValue);
    } catch {
      console.error(`[supabase] Invalid schedule_interval "${integration.schedule_interval}" for integration ${integration.id}, skipping`);
      return false;
    }
    const lastRun = new Date(integration.last_run_at).getTime();
    return now - lastRun >= interval;
  });
}

export async function updateIntegrationState(
  id: number,
  state: {
    last_run_at?: string;
    items_found?: number;
    items_posted?: number;
    last_error?: string | null;
    is_active?: boolean;
  }
): Promise<void> {
  const { error } = await client
    .from("scraper_integrations")
    .update(state)
    .eq("id", id);

  if (error) throw new Error(`Failed to update integration ${id}: ${error.message}`);
}

/**
 * Atomic claim: INSERT ON CONFLICT DO NOTHING.
 * Returns true if the row was inserted (URL is new), false if it already existed.
 */
export async function claimUrl(
  integrationId: number,
  url: string
): Promise<boolean> {
  const { data, error } = await client
    .from("processed_items")
    .upsert(
      { integration_id: integrationId, url, processed_at: new Date().toISOString() },
      { onConflict: "integration_id,url", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    console.error(`Dedup claim failed for ${url}:`, error.message);
    return false;
  }
  // If ignoreDuplicates skipped the row, data will be empty
  return (data?.length ?? 0) > 0;
}

/**
 * Prune processed items for DELETED integrations only.
 * Active integration records are never pruned to prevent re-posting.
 */
export async function pruneOrphanedProcessedItems(): Promise<void> {
  const { error } = await client.rpc("prune_orphaned_processed_items");
  if (error) console.error("Pruning failed:", error.message);
}

/**
 * Check if any previously processed URL for this integration contains the same article ID.
 * Used to catch duplicate articles where the publisher changed the URL slug but kept the same ID.
 */
export async function hasProcessedArticleId(
  integrationId: number,
  articleId: string,
  currentUrl: string
): Promise<boolean> {
  const { data } = await client
    .from("processed_items")
    .select("url")
    .eq("integration_id", integrationId)
    .like("url", `%${articleId}%`)
    .neq("url", currentUrl)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

export { client as supabaseClient };
