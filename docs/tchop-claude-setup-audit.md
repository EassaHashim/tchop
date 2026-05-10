# Audit: tchop.io Claude Code Setup

## Overall Assessment

The setup is well-intentioned but over-engineered in the wrong places and missing critical infrastructure. The rules files total **907 lines** of advisory text that Claude will partially ignore, while there are **zero hooks** to enforce anything deterministically.

---

## CLAUDE.md (56 lines)

**Good:**
- Reasonable length
- Clear core principles (simplicity, no laziness, minimal impact)
- Git safety rules (ask before commit/push)

**Problems:**

1. **Lines 49-57 are dead weight.** "If you are an AI agent: Read this file before suggesting code" is meaningless. Claude already reads it. Cut this entire section.

2. **Rigid agent pipeline is counterproductive.** Lines 32-38 force a Developer -> Security -> Tester -> DocsWriter pipeline for every task. In practice, a one-line typo fix doesn't need security scanning and documentation updates. This creates overhead and wastes tokens. Let the model judge what's needed.

3. **Task management via docs/todo.md is reinventing the wheel.** Claude Code has built-in `TodoWrite` for task tracking. Writing to files adds unnecessary file I/O and creates stale artifacts.

4. **Lines 40-46 manually list rules files.** Rules in `.claude/rules/` auto-load. Listing them here is redundant and creates a maintenance burden when files are added or renamed.

5. **"Capture Lessons" to docs/lessons.md** is a nice idea but fragile. These lessons only survive if someone reads that file. Better to use Claude's memory system or CLAUDE.md itself for truly important lessons.

---

## Rules Files (907 lines total)

**The core problem:** These are advisory, not enforced. Claude will follow some, ignore others, especially as context fills up. The signal-to-noise ratio matters enormously.

### architecture.md (199 lines) -- Cut to ~80

Good bones, but:
- Lines 86-120 ("Architectural Rules for Agents") repeat what lines 148-166 say
- "Common Mistakes to Avoid" section largely duplicates the rules above it
- The commands section (lines 124-144) is the most valuable part and should be in CLAUDE.md directly

### code-style.md (78 lines) -- Best of the bunch

Mostly good. But:
- "Use strict equality" and "Respect ESLint" are things the linter enforces. Don't send an LLM to do a linter's job.
- Could trim to ~50 lines

### folder-structure.md (189 lines) -- Cut to ~60

Half of this is "do not put new code in legacy folders" repeated in different ways. State it once. The actual folder map is useful.

### product-architecture.md (68 lines) -- Good, keep as-is

Good length, good content. This is the strongest rules file.

### testing.md (190 lines) -- Cut to ~60

Most of this is generic testing advice ("prefer behavior over implementation," "keep tests isolated") that any competent model already knows. Keep only what's specific to this repo: Mocha/Chai/Sinon, the test helpers at `src/test/`, the mocha.opts path, and the test file placement convention.

### workflow.md (183 lines) -- Cut to ~40

The most problematic file. This defines a rigid four-stage pipeline that adds ceremony to every task. The "Bug Fix Workflow," "Architectural Tasks," and "CI/Deployment Tasks" sections are all variations of "be careful and verify." Cut to repo-specific guidance only.

**Target: Get total rules under 300 lines.**

---

## Agents

### Massive duplication

`developer.md` and `skills/nodejs-pro/SKILL.md` share ~90% identical content. Pick one.

### Frontmatter descriptions are way too long

The `description` field in agent frontmatter should be 1-2 sentences for matching, not multi-paragraph examples. The examples belong in the body, not the description.

### All agents use `model: sonnet`

Consider using `opus` for the security agent where deeper reasoning matters, and `haiku` for the docs-writer where speed matters more than depth.

### The agents are role-play prompts, not functional agents

They describe what a person with 10+ years experience would do, but don't provide actionable instructions. Compare:

- Bad: "Utilize NestJS's DI system to manage dependencies efficiently"
- Good: "Always inject dependencies via constructor. Never use `moduleRef.get()` outside of dynamic providers."

---

## Settings.json

**Good:**
- Denies `curl` and `.env` reads
- Allows build/lint/test

**Missing:**
- No `Bash(yarn *)` despite Yarn being the package manager (architecture.md says `yarn install --pure-lockfile`)
- No `Bash(git log *)` or `Bash(git diff *)` or `Bash(git status *)` despite CLAUDE.md allowing git read commands
- No `Bash(npx mocha *)` for running individual tests
- No deny for `Read(./secrets/**)` or other sensitive paths
- No deny for `Write(./.env*)` to prevent creating env files

---

## What's Missing Entirely

### 1. No hooks

This is the biggest gap. Anything that must happen deterministically needs a hook, not a rule. Suggestions:
- `PostToolUse` on `Edit|Write` matching `*.ts` to run `npm run lint:ts` on the changed file
- `PreToolUse` on `Edit|Write` to block changes to migration files, startup files, or CI config without confirmation

### 2. No mcp.json

No GitLab integration (for issues, MRs, code search), no database connection, no Sentry for error context. The architecture mentions GitLab CI, Sentry, and various databases. MCP servers for these would make Claude far more effective.

### 3. No launch.json

No dev server configuration for preview tools.

### 4. No context/ directory

product-architecture.md is good but lives in rules/ where it auto-loads every session. Context docs that are only sometimes needed should live in `.claude/context/` and be loaded via `@imports` in CLAUDE.md.

### 5. No .gitignore additions for Claude artifacts

The branch adds `.claude/` to `.gitignore` and `.dockerignore`, but `docs/todo.md` / `docs/lessons.md` (which the workflow creates) aren't addressed.

---

## How Others Do It (Best Practices Comparison)

| Practice | This Repo | Best Practice |
|---|---|---|
| CLAUDE.md length | 56 lines (OK) | Under 100 lines |
| Total rules | 907 lines | Under 300 lines |
| Hooks | None | Format-on-save, file protection |
| Permissions | Basic | Specific allow + deny for all common commands |
| MCP servers | None | GitLab, DB, Sentry, etc. |
| Agent/skill duplication | Heavy | Single source of truth per capability |
| Context loading | Everything auto-loads | Progressive disclosure via @imports |
| Secrets protection | .env only | .env, .env.*, secrets/, credentials |

---

## Priority Recommendations

1. **Cut rules to ~300 lines total.** Remove generic advice Claude already knows. Keep only repo-specific facts.
2. **Add hooks** for linting after edits and protecting infrastructure files.
3. **Fix agent/skill duplication.** Kill either the developer agent or the nodejs-pro skill.
4. **Shorten agent frontmatter descriptions** to 1-2 sentences.
5. **Move product-architecture.md to context/** so it loads on demand, not every session.
6. **Add MCP servers** for GitLab and any other tools the team uses daily.
7. **Expand permissions** to match actual workflow (yarn, git reads, mocha).
8. **Remove the rigid pipeline requirement** from CLAUDE.md. Let the model decide when agents are needed.
