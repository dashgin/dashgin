---
title: "MCP Tool Bloat: Why 546 Tools Cost Me $1,557 (and the ~700-Token Fix)"
description: "The technical deep-dive behind the $1,557 agent bill — token forensics, why deferred tools + prompt caching change everything, and how I replaced a 546-tool MCP server with a curl-based skill that's ~700× smaller."
pubDate: 2026-08-15
tags: ["mcp", "ai-agents", "llm", "context-engineering", "cost"]
draft: false
---

This is the technical companion to *[How My Self-Hosted AI Agent Burned $1,557 in 2 Days](/blog/self-hosted-ai-agent-burned-1557)*. If you want the token math, the root cause, and the actual fix, this is it. No infrastructure specifics — just the mechanics that apply to any agent.

## The forensics

Two days of a self-hosted agent, billed against a managed model API:

- **3,187 model calls**
- **350 million input tokens**, 1.86 million output tokens
- **~110,000 input tokens per call on average** — some at the 500k context ceiling
- Cost: **~$1,557**, of which **97% was input**

Read that last line again. Almost none of the cost was the model *thinking* (output). It was the same giant context being **re-sent and re-billed on every single call**.

## Where 110k tokens per call comes from

One MCP server wrapped a deployment platform and exposed **546 tools**. In a naive agent setup, every one of those 546 tool definitions — name, description, and full JSON parameter schema — gets injected into the model's context on **every** request.

That's ~500k tokens of tool schemas riding along whether the user said "deploy the staging service" or just "hi".

At flagship pricing (~$5 per million input tokens), 100k tokens of tools per call = **~$0.50 per call in tool overhead alone**, before the model reads a single word of the actual conversation. Multiply by thousands of agentic tool-loop iterations, add 3× retries on every error, and you get $1,557 in 48 hours.

## Why the same tools + model are nearly free elsewhere

I use the *same* 546-tool integration with the *same* flagship model in my daily coding agent, for a tiny fraction of the cost. Two mechanisms explain the entire gap:

### 1. Deferred tools (the #1 difference)

A well-designed agent client doesn't dump all tool schemas into context. It keeps only the tool **names** and a one-line description, then fetches a tool's full parameter schema **on demand** — the first time the model actually wants to call it.

- Naive agent: 546 full schemas in context, every call → ~500k tokens
- Deferred: ~546 names in context, schemas fetched as needed → a few k tokens

Same capability. ~100× less context. This alone would have turned my $1,557 into ~$15.

### 2. Prompt caching

The static prefix of a request — system prompt + tool definitions — is identical across calls in a session. With prompt caching enabled, that block is written to cache once and **read at ~10% of the input price** on subsequent calls (or skipped entirely on exact hits).

My self-hosted agent had caching **off** by default, so it paid full input price for the entire bloated prefix on every one of 3,187 calls.

**Same model. Same tools. The cost difference was 100% context management.**

## The real fix: a skill instead of an MCP server

Here's the insight that generalizes. **You almost never need 546 tools. You need about 10.** Deploy, redeploy, restart, stop, logs, create, add-a-domain — that's the daily reality.

So instead of an MCP server that injects 546 typed tools, I wrote a **skill**: a ~700-token Markdown doc that teaches the agent to hit the platform's HTTP API with `curl`, using the *one* generic terminal tool it already has.

| | MCP server | Skill (curl + docs) |
|---|---|---|
| Tools in context | 546 schemas (~500k tokens) | 1 generic tool + ~700-token doc |
| When loaded | every call | only when relevant (progressive disclosure) |
| Reliability | high (typed params) | slightly lower (agent builds the call) |
| Per-call cost | ~$2.50 | ~$0.003 |

The skill documents the ~10 common operations as copy-paste `curl` examples, and points to the full API spec **for the rare cases** — so the 500+ other operations are fetched on demand and never sit in context. Roughly **700× smaller** per call.

This is the pattern for any fat MCP on a self-hosted agent: **if a server exposes dozens of tools you mostly don't use, a skill that documents the API and uses the terminal is dramatically cheaper.** MCP's typed-tool reliability is worth it for a handful of tools, or in a client that defers schemas — not for 546 loaded on every call.

## The rebuild checklist

If I were standing this agent back up, in order of impact:

1. **Don't default to the flagship model.** Use a strong mid-tier or efficient open model as the daily driver; reserve the flagship for genuinely hard tasks. (5–70× cheaper.)
2. **Don't load a 546-tool MCP into a client that can't defer.** Replace it with a skill, or trim the toolset. (~100× less context.)
3. **Enable prompt caching.** Stop re-billing the static prefix. (~90% off repeat calls.)
4. **Cap the budget low.** Budget alarms lag ~a day; a $50 cap catches a runaway before a $200 one would.
5. **Bound the loops.** Lower max-turns so an agentic loop can't spiral, and don't retry 3× into a wall.

With all five, the same usage that cost $1,557 would run **under $30**.

## The one-line takeaway

**Tokens are not just what the model writes — they're everything you make it read, every time.** A 546-tool MCP is 546 tools you pay for on every call. Manage the context, and a self-hosted agent is cheap. Ignore it, and it's a four-figure surprise.
