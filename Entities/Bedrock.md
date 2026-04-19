---
created: 2026-04-19T00:00:00.000Z
updated: '2026-04-19'
type: entity
refs: 4
tier: active
---

# Bedrock

AWS's managed LLM serving platform. Runs third-party models (DeepSeek, Qwen, etc.) at scale, internally on a private vLLM v1 fork optimized for Trainium perf/TCO.

## Synthesis

Serves as one half of AWS's "big internal customer" for Trainium perf tuning (the other being Anthropic). Bedrock's workloads have shaped early NKI kernel work.

## Observations

- Runs [[DeepSeek]]/[[Qwen]]/etc. on a private fork of vLLM v1 — a Bedrock-specific inference path distinct from Anthropic's custom engine. — [[2026-04-19-aws-trainium3-deep-dive]]
