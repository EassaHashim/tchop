import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config";
import { pollOnce } from "./poll";
import { pruneOrphanedProcessedItems } from "./services/supabase";
import { registerPreviewRoutes } from "./handlers/preview";
import { registerHealthRoutes } from "./handlers/health";
import { registerIntegrationRoutes } from "./handlers/integrations";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true, methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] });

registerPreviewRoutes(app);
registerHealthRoutes(app);
registerIntegrationRoutes(app);

let shuttingDown = false;
let pollTimeout: ReturnType<typeof setTimeout>;
let pruneInterval: ReturnType<typeof setInterval>;

async function schedulePoll(): Promise<void> {
  if (shuttingDown) return;
  try {
    await pollOnce();
  } catch (err) {
    console.error("[worker] Poll cycle failed:", err);
  }
  if (!shuttingDown) {
    pollTimeout = setTimeout(schedulePoll, config.worker.pollIntervalMs);
  }
}

async function start(): Promise<void> {
  await app.listen({ port: config.worker.port, host: "0.0.0.0" });
  console.log(`[worker] HTTP server listening on port ${config.worker.port}`);

  // Start polling with setTimeout chaining (not setInterval)
  console.log(`[worker] Polling every ${config.worker.pollIntervalMs / 1000}s`);
  schedulePoll();

  // Prune orphaned processed items daily
  pruneInterval = setInterval(pruneOrphanedProcessedItems, 24 * 60 * 60 * 1000);
}

// Graceful shutdown: wait for in-flight poll cycle
async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] ${signal} received, shutting down...`);
  shuttingDown = true;
  clearTimeout(pollTimeout);
  clearInterval(pruneInterval);

  // Wait for in-flight poll to finish (max 30s)
  const start = Date.now();
  const { isPolling } = await import("./poll");
  while (isPolling() && Date.now() - start < 30_000) {
    await new Promise((r) => setTimeout(r, 500));
  }

  await app.close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((err) => {
  console.error("[worker] Failed to start:", err);
  process.exit(1);
});
