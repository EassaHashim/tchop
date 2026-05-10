#!/bin/bash
# Auto-restart wrapper for the scraper service
# Usage: ./start.sh

cd "$(dirname "$0")"

while true; do
  echo "[$(date)] Starting scraper service..."
  bun run src/index.ts
  EXIT_CODE=$?
  echo "[$(date)] Service exited with code $EXIT_CODE. Restarting in 5s..."
  sleep 5
done
