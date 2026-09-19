---
title: "How My Self-Hosted AI Agent Burned $1,557 in 2 Days"
description: "I put an always-on AI agent on my own server. Two days later AWS billed me $1,557. Here's exactly what happened, why, and how the same setup costs pennies when done right."
pubDate: 2026-08-15
tags: ["ai-agents", "aws", "bedrock", "cost", "post-mortem"]
draft: false
---

I set out to self-host an AI agent: a little always-on assistant on my own server, wired into Telegram, web search, and my infrastructure. Two days later AWS had billed me **$1,557**.

Here's exactly what happened, why, and how the *same setup* costs pennies when done right.

## The setup

I put **Hermes Agent** on a small EC2 box and connected it to **AWS Bedrock** for the model. Over an afternoon it grew into a proper little stack:

- **Claude Opus 5** as the brain
- A Telegram bot + self-hosted web search
- Vision, and a web dashboard behind a domain
- A handful of **MCP servers** for tools, including the **Dokploy MCP server**, which exposed **546 tools**

It worked. It also, quietly, started printing money. For the cloud provider.

## The bill

I checked the cost dashboard expecting maybe $20. Instead:

```
Day 1:  $640
Day 2:  $916   ← and still climbing
─────────────
       $1,557  in 48 hours
```

A budget kill-switch I'd set up *did* fire and cut it off, but budget data lags almost a day, so it slammed the brakes only *after* $1,557 had already gone through.

## Why it happened (three mistakes, stacked)

The forensics were brutal and clear: **3,187 model calls, 350 million input tokens** in two days. The average call sent **110,000 tokens**, and some hit **500,000** (the model's ceiling). For simple "hi" messages. Three things multiplied together:

**1. I used the most expensive model as the default.**
Claude Opus 5 is $5 per million input tokens, $25 per million output. Great model. Terrible default for a chatty, always-on agent.

**2. I loaded 546 tools into every single call.**
This is the big one. The Dokploy MCP server dumped all 546 of its tool definitions (roughly 500k tokens of JSON schemas) into the context of **every request**. At Opus prices that's **~$2.50 per call, just to say hello.**

**3. No caching, and retries on every error.**
The model re-read that giant context from scratch on every call (no prompt caching on Bedrock by default). And my error-heavy setup meant every failure retried 3×: three real, expensive calls each.

Cheap model? No. Small context? No. Caching? No. It was the perfect storm.

## The plot twist: I use the exact same thing every day, and it's basically free

Here's what stung. I use that *same* Dokploy MCP server with the *same* Opus 5 inside **Claude Code** constantly, and it costs me nothing close to this.

Why? Two things Claude Code does that my self-hosted agent didn't:

**Deferred tools.** Claude Code keeps only the tool *names* in context and fetches a tool's full schema **only when it actually needs it**. It carries ~1% of those 546 definitions per call. My agent stuffed 100% of them into every request. Same MCP server, 100× the context.

**Prompt caching.** The big static block of tools and system prompt gets cached, so repeat calls pay ~90% less for it. On Bedrock, with caching off, I paid full price every time.

Same model. Same tools. The difference was entirely in *how the context was managed.*

## What the same usage would have cost

| Model | Same ~350M tokens |
|---|---|
| **Claude Opus 5 (what I ran)** | **~$1,800** |
| Kimi K2.5 | ~$215 |
| Qwen3-Next | ~$50 |
| GLM-4.7-flash | ~$25 |

And that's *before* fixing the context bloat. A cheaper model **+** deferred/trimmed tools **+** caching would have turned the whole two-day binge into **under $30**.

## The lessons

If you self-host an AI agent with tools, tattoo these somewhere:

1. **Don't default to the flagship model.** A cheap-but-capable model (Kimi, GLM, Qwen) as the daily driver, Opus only for hard tasks.
2. **Tools are not free: they ride in your context.** 546 tools in every call is 546 tools you pay for in every call. Trim them, or use a client that defers tool schemas.
3. **Turn on prompt caching.** Static context (tools, system prompt) should be cached, not re-billed every call.
4. **Your budget alarm lags ~a day.** Set the cap *low*, because you'll blow past it before it notices.
5. **Retries multiply mistakes.** An error-heavy config with 3× retries is 3× the burn.

I killed the VM, kept encrypted backups, and rotated every key. The $1,557 was a one-time tuition payment. The agent itself was a good idea. I just handed it the priciest model, buried it in tools, and turned off every cost-saving feature at once.

Do the opposite, and a self-hosted agent is genuinely cheap. Ask me how I know.

*A deeper technical breakdown (the token math, the fix, and how I turned a 546-tool integration into a ~700-token skill) is in the [companion post](/blog/mcp-tool-bloat-deferred-tools-caching).*
