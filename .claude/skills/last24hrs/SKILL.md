---
name: last24hrs
version: "1.0"
description: "Research a topic from the last 24 hours. Thin wrapper around last30days with --days=1."
argument-hint: 'last24hrs AI video tools'
allowed-tools: Bash, Read, Write, AskUserQuestion, WebSearch
user-invocable: true
disable-model-invocation: true
---

# last24hrs: Last 24 Hours Research

This is a thin alias for `/last30days` that automatically sets `--days=1`.

## How to execute

1. Take the user's arguments exactly as provided
2. Read and follow ALL instructions from the main skill file at `.claude/skills/last30days/SKILL.md`
3. The ONLY difference: when constructing the python3 command, always append `--days=1` to the arguments
4. Everything else -- intent parsing, research execution, synthesis, output format -- follows the main skill verbatim
