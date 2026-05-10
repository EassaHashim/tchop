import { config } from "../config";
import type { Integration } from "../types";

async function send(text: string): Promise<void> {
  if (!config.slack.webhookUrl) return;
  try {
    await fetch(config.slack.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error("[slack] Failed to send:", (err as Error).message);
  }
}

export async function notifyError(integration: Integration, error: string): Promise<void> {
  await send([
    `:rotating_light: *Scraper integration error*`,
    ``,
    `*Integration:* ${integration.name} (ID: ${integration.id})`,
    `*Mode:* ${integration.monitoring_mode}`,
    `*Source:* ${integration.source_url}`,
    `*Channel ID:* ${integration.channel_id} | *Mix ID:* ${integration.mix_id || "none"}`,
    `*Org:* ${integration.org_id}`,
    ``,
    `\`\`\`${error.slice(0, 500)}\`\`\``,
  ].join("\n"));
}

export async function notifyAuthFailure(integration: Integration): Promise<void> {
  await send([
    `:key: *Auth failure -- integration paused*`,
    ``,
    `*Integration:* ${integration.name} (ID: ${integration.id})`,
    `*Org:* ${integration.org_id}`,
    ``,
    `The tchop API token may have expired. Integration was automatically paused.`,
  ].join("\n"));
}

export async function notifyQuotaExhausted(): Promise<void> {
  await send(`:warning: *Firecrawl API quota exhausted.* All scraper integrations paused. Check Firecrawl plan limits.`);
}
