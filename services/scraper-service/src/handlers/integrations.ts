import type { FastifyInstance } from "fastify";
import { supabaseClient } from "../services/supabase";
import { requireAuth } from "../middleware/auth";
import { isBlockedUrl } from "../middleware/validation";

function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return isNaN(id) ? null : id;
}

export function registerIntegrationRoutes(app: FastifyInstance): void {
  app.post<{ Body: Record<string, unknown> }>("/integrations", async (request, reply) => {
    if (!requireAuth(request, reply)) return;

    const sourceUrl = request.body.source_url;
    if (typeof sourceUrl === "string" && isBlockedUrl(sourceUrl)) {
      return reply.status(400).send({ error: "URL not allowed (private/internal addresses are blocked)" });
    }

    const { data, error } = await supabaseClient
      .from("scraper_integrations")
      .insert(request.body)
      .select();

    if (error) return reply.status(400).send({ error: error.message });
    return reply.status(201).send(data);
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>("/integrations/:id", async (request, reply) => {
    if (!requireAuth(request, reply)) return;

    const id = parseId(request.params.id);
    if (!id) return reply.status(400).send({ error: "Invalid integration ID" });

    const { data, error } = await supabaseClient
      .from("scraper_integrations")
      .update(request.body)
      .eq("id", id)
      .select();

    if (error) return reply.status(400).send({ error: error.message });
    return reply.send(data);
  });

  app.delete<{ Params: { id: string } }>("/integrations/:id", async (request, reply) => {
    if (!requireAuth(request, reply)) return;

    const id = parseId(request.params.id);
    if (!id) return reply.status(400).send({ error: "Invalid integration ID" });

    const { error } = await supabaseClient
      .from("scraper_integrations")
      .delete()
      .eq("id", id);

    if (error) return reply.status(400).send({ error: error.message });
    return reply.status(204).send();
  });
}
