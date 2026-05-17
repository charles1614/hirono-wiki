---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://github.com/MoonshotAI/K2-Vendor-Verifier
tags: [inference, evaluation, benchmark]
---

# [2025-10-12] MoonshotAI/K2-Vendor-Verifier: Verify Precision of all Kimi K2 API Vendors

## TL;DR

[[Moonshot AI]]'s open-source tool (K2VV) for continuously benchmarking third-party [[Kimi K2]] API vendors on tool-call accuracy. The benchmark runs 4,000 requests per vendor and measures two metrics: ToolCall-Trigger Similarity (tool_call_f1) and ToolCall-Schema Accuracy (schema_accuracy). Large variance found across vendors — official MoonshotAI API scores 100% on both; open-source inference engines (vLLM, SGLang) score 73–87% on schema accuracy.

## Key claims

- `tool_call_f1` (harmonic mean of trigger-precision and trigger-recall) is the primary deployment quality check; MoonshotAI sets acceptable thresholds at ≥73% for kimi-k2-thinking and ≥80% for kimi-k2-0905-preview.
- For kimi-k2-thinking: MoonshotAI and Moonshot AI Turbo reach 100% schema accuracy; vLLM scores 87.22%, SGLang 95.52%, Together 84.63%.
- For kimi-k2-0905-preview: vLLM 76%, SGLang 73.13%, Volc 72.86%, Groq triggers only 69.52% (below threshold), Nebius triggers only 50.60%.
- Three root-cause fixes: (1) use correct vLLM/SGLang versions (vLLM ≥v0.11.0, SGLang ≥v0.5.3rc0); (2) rename tool call IDs to `functions.func_name:idx` format; (3) add guided encoding (constrained decoding) to enforce JSON schema.
- [[Kimi K2]] tool IDs in the format `functions.func_name:idx` must be preserved in historical messages; malformed IDs like `search:0` cause K2 to generate incorrect tool call IDs.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[Moonshot AI]], [[Kimi K2]]

## Topics touched

[[MoE Serving]], [[LLM Inference Systems]], [[Constrained Decoding]]

## Raw source

[github.com/MoonshotAI/K2-Vendor-Verifier](https://github.com/MoonshotAI/K2-Vendor-Verifier) — GitHub README, tested 2025-11-15. Read 2026-05-15.
