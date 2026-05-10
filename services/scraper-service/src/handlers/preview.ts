import type { FastifyInstance } from "fastify";
import { discoverUrlsWithFallback, scrapeUrl } from "../services/firecrawl";
import type { PreviewRequest, PreviewResponse } from "../types";
import { requireAuth } from "../middleware/auth";
import { isBlockedUrl } from "../middleware/validation";

export function registerPreviewRoutes(app: FastifyInstance): void {
  app.post<{ Body: PreviewRequest }>("/preview", async (request, reply) => {
    if (!requireAuth(request, reply)) return;

    const { monitoring_mode, source_url, max_pages, search_terms, sample_url } = request.body;

    if (!monitoring_mode || !source_url) {
      return reply.status(400).send({ error: "monitoring_mode and source_url are required" });
    }

    if (isBlockedUrl(source_url)) {
      return reply.status(400).send({ error: "URL not allowed (private/internal addresses are blocked)" });
    }

    const timeout = monitoring_mode === "crawl" ? 180_000 : 30_000;

    try {
      const result = await Promise.race([
        executePreview(monitoring_mode, source_url, max_pages, search_terms, sample_url),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Preview timed out")), timeout)
        ),
      ]);

      return reply.send(result);
    } catch (err: any) {
      if (err.message === "Preview timed out") {
        return reply.status(504).send({ error: "Preview timed out. Try a narrower URL pattern." });
      }
      console.error("[preview] Error:", err.message);
      return reply.status(502).send({ error: `Source unreachable: ${err.message}` });
    }
  });
}

async function executePreview(
  mode: "crawl" | "scrape",
  sourceUrl: string,
  maxPages?: number,
  searchTerms?: string | null,
  sampleUrl?: string | null
): Promise<PreviewResponse> {
  if (mode === "crawl") {
    const { items } = await discoverUrlsWithFallback(sourceUrl, maxPages || 50, searchTerms, sampleUrl);
    return { items, count: items.length, mode: "crawl" };
  }

  const item = await scrapeUrl(sourceUrl);
  return { items: [item], count: 1, mode: "scrape" };
}
