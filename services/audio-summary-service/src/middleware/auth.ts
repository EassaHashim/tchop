import type { FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config.ts";

export function requireAuth(request: FastifyRequest, reply: FastifyReply): boolean {
  const token = request.headers["x-api-key"] || request.headers.authorization?.replace("Bearer ", "");
  if (!token || token !== config.graphApi.token) {
    reply.status(401).send({ error: "Unauthorized" });
    return false;
  }
  return true;
}
