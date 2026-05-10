FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

COPY src/ src/
COPY tsconfig.json test-ui.html ./

EXPOSE 3000

HEALTHCHECK --interval=60s --timeout=5s --retries=3 \
  CMD curl -sf http://localhost:3000/health || exit 1

CMD ["bun", "run", "src/index.ts"]
