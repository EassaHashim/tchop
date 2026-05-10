import { config } from "../config.ts";
import type { AudioIntegration } from "../types.ts";

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

export async function notifyError(integration: AudioIntegration, error: string): Promise<void> {
  await send([
    `:rotating_light: *Audio summary error*`,
    ``,
    `*Integration:* ${integration.name} (ID: ${integration.id})`,
    `*Org:* ${integration.org_id}`,
    `*Schedule:* ${integration.schedule}`,
    ``,
    `\`\`\`${error.slice(0, 500)}\`\`\``,
  ].join("\n"));
}

export async function notifyAuthFailure(integration: AudioIntegration): Promise<void> {
  await send([
    `:key: *Auth failure -- audio summary integration paused*`,
    ``,
    `*Integration:* ${integration.name} (ID: ${integration.id})`,
    `*Org:* ${integration.org_id}`,
    ``,
    `The tchop API token may have expired. Integration was automatically paused.`,
  ].join("\n"));
}
