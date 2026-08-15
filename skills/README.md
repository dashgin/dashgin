# AI Skills & Tooling

How I actually work with AI agents — the custom skills I've built, the tools I lean on daily, and the workflow that keeps it fast *and* cheap.

> Context for the cost-consciousness: I once let a self-hosted agent burn
> **$1,557 in 2 days** by loading 546 tools into every model call on the
> priciest model with caching off. The write-ups:
> [the story](../src/content/blog/self-hosted-ai-agent-burned-1557.md) ·
> [the technical fix](../src/content/blog/mcp-tool-bloat-deferred-tools-caching.md).
> Most of what's below is shaped by that lesson: **manage the context.**

---

## Custom skills I've built

Skills I extracted from real projects and generalized into reusable agent capabilities.

| Skill | What it does |
|---|---|
| **[dokploy](./dokploy/SKILL.md)** | Manage a Dokploy PaaS via its HTTP API with `curl` instead of the 546-tool MCP server — ~700 tokens vs ~500k per call. The concrete fix from the cost post-mortem. |
| **first-win-onboarding** | Build a "First Win" guided first-run for a mobile app (the Clash-Royale trick): a scripted, can't-fail first session that delivers the magic moment by the user's own hand, then reveals the paywall at peak dopamine. Generalized from a real app. |
| **seed-dev-data** | A modular seeder system for Django backends — a `BaseSeeder` per app auto-discovered by `manage.py seed`, an `is_seed` flag for scoped teardown, `just seed / --clear / --list / --modules`. So a fresh DB, admin, and app are never empty. |
| **mobile-store-release** | Ship an Expo/RN app to the App Store + Play Store: a Playwright script renders the web bundle in headless Chrome at exact store pixel sizes, seeds demo data, and writes localized screenshots into a versioned release tree — plus an EAS build/submit runbook. |
| **harden-web-service** | Security-audit and harden a Django service behind Dokploy + Traefik + Cloudflare — the money-path checks generic tooling misses (refund caps, idempotency-with-amount, callback forgery), Django settings that silently no-op, and closing the origin-bypass hole. |

The **dokploy** skill is included here in full (genericized) as the flagship example — it's the pattern I reach for whenever an MCP server exposes dozens of tools I mostly don't use: **document the API + use the terminal, don't load 546 typed tools.**

---

## Skills & tools I use daily

**Agent workflow** (the [superpowers](https://github.com/anthropics/claude-plugins-official) suite):
`brainstorming` · `writing-plans` · `executing-plans` · `subagent-driven-development` · `dispatching-parallel-agents` · `test-driven-development` · `systematic-debugging` · `verification-before-completion` · `requesting-code-review` · `using-git-worktrees`

**Design & frontend:**
`frontend-design` · `impeccable` (UI critique/polish + design systems) · `dataviz` · `artifact-design`

**Code quality:**
`code-review` · `simplify` · `security-review`

**MCP servers I connect** (per project, scoped):
`context7` (live docs) · `dbhub` (Postgres inspector) · `playwright` (browser) · `dokploy` (deployment) · `cloudflare-api` · `uptime-kuma` · `mcp-mermaid` (diagrams) · `expo` · `revenuecat` · `mobile-mcp` — plus a custom local MCP server for my mobile release kit.

---

## How I work with AI (the workflow)

A few conventions, encoded in my project `CLAUDE.md` files, that keep agent work fast and correct:

1. **Plan mode by default** for anything 3+ steps — design before touching code.
2. **Subagents, liberally** — offload research and parallel exploration to keep the main context clean (and cheap).
3. **A self-improvement loop** — after any correction, the pattern goes into `tasks/lessons.md` so the same mistake doesn't repeat.
4. **Per-project memory** — accumulated notes (gotchas, decisions, corrections) that persist across sessions.
5. **Verification before "done"** — run it, prove it, "would a staff engineer approve?"
6. **Token-cost consciousness** — deferred tools, prompt caching, cheap models for cheap tasks. The $1,557 lesson, internalized.

7. **Generalize the win** — when a project pattern proves itself (onboarding, seeding, releases), extract it into a reusable skill. That's where the custom skills above came from.
