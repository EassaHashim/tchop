import type { FastifyInstance } from "fastify";
import { supabaseClient } from "../services/supabase";
import { requireAuth } from "../middleware/auth";
import { readFileSync } from "fs";
import { join } from "path";

export function registerHealthRoutes(app: FastifyInstance): void {
  // Health check is public (for monitoring/load balancers)
  app.get("/health", async (_request, reply) => {
    try {
      const { count, error } = await supabaseClient
        .from("scraper_integrations")
        .select("id", { count: "exact", head: true });

      if (error) throw error;

      return reply.send({
        status: "ok",
        integrations: count,
        uptime: process.uptime(),
      });
    } catch {
      return reply.status(503).send({ status: "unhealthy" });
    }
  });

  // Test UI served at /ui
  app.get("/ui", async (_request, reply) => {
    try {
      const paths = [
        join(import.meta.dir, "../../test-ui.html"),
        join(process.cwd(), "test-ui.html"),
        "/app/test-ui.html",
      ];
      let html = "";
      for (const p of paths) {
        try { html = readFileSync(p, "utf-8"); break; } catch { continue; }
      }
      if (!html) throw new Error("not found");
      return reply.type("text/html").send(html);
    } catch {
      return reply.status(404).send("UI not found");
    }
  });

  // Status endpoint requires auth (contains org data)
  app.get("/integrations/status", async (request, reply) => {
    if (!requireAuth(request, reply)) return;

    const { data, error } = await supabaseClient
      .from("scraper_integrations")
      .select("id, name, monitoring_mode, source_url, is_active, last_run_at, items_found, items_posted, last_error")
      .order("created_at", { ascending: false });

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    return reply.send({ integrations: data });
  });
}
