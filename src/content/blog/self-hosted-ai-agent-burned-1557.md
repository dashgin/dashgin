---
title: "How My Self-Hosted AI Agent Burned $1,557 in 2 Days"
description: "I put an always-on AI agent on my own server. Two days later AWS billed me $1,557. Here's exactly what happened, why, and how the same setup costs pennies when done right."
pubDate: 2026-08-15
tags: ["ai-agents", "aws", "bedrock", "cost", "post-mortem"]
draft: false
---

I set out to self-host an AI agent — a little always-on assistant on my own server, wired into Telegram, web search, and my infrastructure. Two days later AWS had billed me **$1,557**.

Here's exactly what happened, why, and how the *same setup* costs pennies when done right.

## The setup

I put a self-hosted agent on a small cloud VM and connected it to a managed model API for the brain. Over an afternoon it grew into a proper little stack:

- A **flagship-tier model** as the brain
- A Telegram bot + self-hosted web search
- Vision, and a web dashboard behind a domain
- A handful of **MCP servers** for tools — including one that wrapped my deployment platform and exposed **546 tools**

It worked. It also, quietly, started printing money — for the cloud provider.

## The bill

I checked the cost dashboard expecting maybe $20. Instead:

```
Day 1:  $640
Day 2:  $916   ← and still climbing
─────────────
       $1,557  in 48 hours
```

A budget kill-switch I'd set up *did* fire and cut it off — but budget data lags almost a day, so it slammed the brakes only *after* $1,557 had already gone through.

## Why it happened (three mistakes, stacked)

The forensics were brutal and clear: **3,187 model calls, 350 million input tokens** in two days. The average call sent **110,000 tokens** — some hit **500,000** (the model's ceiling). For simple "hi" messages. Three things multiplied together:

**1. I used the most expensive model as the default.**
The flagship tier runs ~$5 per million input tokens, ~$25 per million output. Great model. Terrible default for a chatty, always-on agent.

**2. I loaded 546 tools into every single call.**
This is the big one. That one MCP server dumped all 546 of its tool definitions — roughly 500k tokens of JSON schemas — into the context of **every request**. At flagship prices that's **~$2.50 per call, just to say hello.**

**3. No caching, and retries on every error.**
The model re-read that giant context from scratch on every call (no prompt caching by default). And my error-heavy setup meant every failure retried 3× — three real, expensive calls each.

Cheap model? No. Small context? No. Caching? No. It was the perfect storm.

## The plot twist: I use the exact same thing every day, and it's basically free

Here's what stung. I use that *same* deployment-platform tool integration with the *same* flagship model inside my everyday coding agent — constantly — and it costs me next to nothing.

Why? Two things my daily tool does that my self-hosted agent didn't:

**Deferred tools.** A well-built agent client keeps only the tool *names* in context and fetches a tool's full schema **only when it actually needs it**. It carries ~1% of those 546 definitions per call. My self-hosted agent stuffed 100% of them into every request. Same tools — 100× the context.

**Prompt caching.** The big static block of tools and system prompt gets cached, so repeat calls pay ~90% less for it. My self-hosted agent had caching off, so it paid full price every time.

Same model. Same tools. The difference was entirely in *how the context was managed.*

## What the same usage would have cost

| Model tier | Same ~350M tokens |
|---|---|
| **Flagship (what I ran)** | **~$1,800** |
| Strong mid-tier | ~$215 |
| Efficient open model | ~$50 |
| Small/fast model | ~$25 |

And that's *before* fixing the context bloat. A cheaper model **+** deferred/trimmed tools **+** caching would have turned the whole two-day binge into **under $30**.

## The lessons

If you self-host an AI agent with tools, tattoo these somewhere:

1. **Don't default to the flagship model.** A cheap-but-capable model as the daily driver, flagship only for hard tasks.
2. **Tools are not free — they ride in your context.** 546 tools in every call is 546 tools you pay for in every call. Trim them, or use a client that defers tool schemas.
3. **Turn on prompt caching.** Static context (tools, system prompt) should be cached, not re-billed every call.
4. **Your budget alarm lags ~a day.** Set the cap *low*, because you'll blow past it before it notices.
5. **Retries multiply mistakes.** An error-heavy config with 3× retries is 3× the burn.

I killed the VM, kept encrypted backups, and rotated every key. The $1,557 was a one-time tuition payment. The agent itself was a good idea — I just handed it the priciest model, buried it in tools, and turned off every cost-saving feature at once.

Do the opposite, and a self-hosted agent is genuinely cheap. Ask me how I know.

*A deeper technical breakdown — the token math, the fix, and how I turned a 546-tool integration into a ~700-token skill — is in the [companion post](/blog/mcp-tool-bloat-deferred-tools-caching).*
