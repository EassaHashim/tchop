import { fetchDueIntegrations, updateIntegrationState } from "./services/supabase";
import { executeCrawl } from "./modes/crawl";
import { executeScrape } from "./modes/scrape";
import { AuthenticationError } from "./services/graphapi";
import type { Integration } from "./types";

let isRunning = false;

export function isPolling(): boolean {
  return isRunning;
}

export async function pollOnce(): Promise<void> {
  if (isRunning) {
    console.log("[poll] Previous cycle still running, skipping");
    return;
  }

  isRunning = true;
  try {
    const integrations = await fetchDueIntegrations();
    if (integrations.length === 0) return;

    console.log(`[poll] ${integrations.length} integration(s) due`);

    // Process sequentially to prevent rate limiting
    for (const integration of integrations) {
      try {
        await executeIntegration(integration);
      } catch (err: any) {
        if (err instanceof AuthenticationError) {
          console.error(`[poll] Auth error for org ${integration.org_id}, skipping remaining for this org`);
          continue;
        }
        console.error(`[poll] Integration ${integration.id} failed:`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[poll] Cycle failed:", err.message);
  } finally {
    isRunning = false;
  }
}

async function executeIntegration(integration: Integration): Promise<void> {
  console.log(`[poll] Running ${integration.monitoring_mode} for "${integration.name}" (${integration.id})`);

  switch (integration.monitoring_mode) {
    case "crawl":
      await executeCrawl(integration);
      break;
    case "scrape":
      await executeScrape(integration);
      break;
    default:
      console.error(`[poll] Unknown mode: ${integration.monitoring_mode}`);
      await updateIntegrationState(integration.id, {
        last_error: `Unknown monitoring mode: ${integration.monitoring_mode}`,
      });
  }
}
