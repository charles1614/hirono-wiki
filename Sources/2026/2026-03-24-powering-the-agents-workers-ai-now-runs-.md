---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://blog.cloudflare.com/workers-ai-large-models/
tags: [inference, production-deployment, announcement]
---

# [2026-03-19] Powering the Agents: Workers AI Now Runs Large Models, Starting with Kimi K2.5

## TL;DR

Cloudflare's Workers AI platform now hosts frontier-scale open-source models, launching with [[Kimi K2.5]] from [[Moonshot AI]]. Cloudflare reduced inference costs by 77% for an internal security-review agent processing 7B tokens/day by switching from a proprietary model to Kimi K2.5. New platform features — prefix caching, session-affinity routing, and a redesigned async API — target agentic workloads at scale.

## Key claims

- [[Kimi K2.5]] on Workers AI offers a 256k context window, multi-turn tool calling, vision inputs, and structured outputs for agentic tasks.
- Cloudflare's security-review agent processes over 7B tokens/day; switching to Kimi K2.5 via Workers AI cut costs 77% vs a mid-tier proprietary model (projected $2.4M/yr → ~$552K/yr).
- Workers AI's inference engine ([[Infire]]) uses custom kernels plus disaggregated prefill, tensor/data/expert parallelism to optimize throughput for large models.
- Prefix caching now surfaces cached-token counts in usage metrics and offers a discount on cached tokens; a new `x-session-affinity` header routes requests to the same model instance to maximize hit rates.
- Redesigned async API (pull-based queue vs prior push-based) processes requests when GPU headroom exists; internal testing shows async requests execute within ~5 minutes.
- Workers AI positions itself as a single unified platform for the full agent lifecycle (state via Durable Objects, execution via Workflows/Sandbox, model via Workers AI).

## Visual observations

*No load-bearing images — blog hero image and closing graphic carry no diagram or data content.*

## What this changes

Cloudflare entering the frontier-model inference market with an open-source-first, serverless pricing model increases competitive pressure on proprietary inference providers. The 77% cost reduction claim is a concrete benchmark for open-source vs proprietary at production scale.

## Entities touched

[[Cloudflare]], [[Workers AI]], [[Kimi K2.5]], [[Moonshot AI]], [[Infire]], [[Inference Disaggregation]]

## Topics touched

[[LLM Inference Systems]], [[Agentic AI Infrastructure]], [[KV Cache Management]]

## Raw source

[blog.cloudflare.com/workers-ai-large-models](https://blog.cloudflare.com/workers-ai-large-models/) — Cloudflare engineering blog, 2026-03-19. Read 2026-05-15.
