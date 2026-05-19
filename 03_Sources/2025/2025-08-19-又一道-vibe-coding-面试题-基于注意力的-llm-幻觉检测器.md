---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://01.me/2025/08/attention-based-hallucination-detection/
tags: [evaluation, attention-kernels, minimal-impl]
---

# [2025-08-19] 又一道 Vibe Coding 面试题：基于注意力的 LLM 幻觉检测器

## TL;DR

[[Bojie Li]] (founder of [[Pine AI]]) documents a 2-hour vibe coding interview challenge: build an **attention-weight-based LLM 幻觉 (hallucination) detector** using Qwen 2.5 0.5B Instruct and the Transformers library. The core empirical finding: when a model generates factual tokens grounded in the system prompt, the **last Transformer layer's cross-attention to the system-prompt region peaks above ~10%**; when the model hallucinates, that peak stays below 10%. A single `max(attention_weights[5:system_prompt_end]) > 0.1` threshold implemented as a `LogitsProcessor` is sufficient for the demo setting. The post also illustrates a visualization-first discovery workflow: build the heatmap before designing the algorithm, let the data surface the signal.

## Key claims

- **Attention-peak signal for hallucination**: when a model outputs a factual token present in the system prompt, it must "look back" at that position — producing a clear peak (>10%) in cross-attention to the system-prompt region of the last Transformer layer. When fabricating the answer, no such peak forms and attention stays diffuse or anchors only on the user-query region.
- **Single-metric algorithm**: `Max System Attention = max(attention_weights[5:system_prompt_end])` (skipping the first 4–5 tokens which carry anomalously high attention); threshold at 10%. Triggered only when a digit sequence is detected, to avoid false positives on routine tokens.
- **Input sequence segmentation matters**: the attention matrix must be decomposed into `[系统提示 (system prompt)] + [用户提示 (user query)] + [生成内容 (generated tokens)]`. The generated-tokens-to-generated-tokens autoregressive self-attention (the right-side triangle) must be excluded from the hallucination signal — it is always high due to positional recency bias and is uninformative for grounding detection.
- **Missing autoregressive triangle was an early bug**: the first implementation saved only cross-attention from generated tokens to prefill context, omitting the generated-to-generated triangle — producing a visually incomplete heatmap. Diagnosing and articulating this (not asking the AI "why is it wrong?") is highlighted as the correct vibe coding debugging posture.
- **Limitation acknowledged**: this demo only covers 无中生有 (outright fabrication) hallucinations, not 张冠李戴 (attribution confusion — assigning one entity's details to another). Production-grade hallucination detection is considerably more complex.
- **Vibe coding framing**: the operator must be architect, product manager, and teacher; AI is a high-executing intern. Precise directives ("implement X with requirements Y, Z") consistently outperform open queries ("how should we do this?"). The 2-hour completion time for the full detection + visualization system is the evidence for the method's leverage.

## Visual observations

**Fig: 非幻觉场景 1 — system-prompt attention heatmap (left portion)**

![非幻觉场景 1: 热力图左侧部分，system prompt 部分有明显的注意力峰值](https://hirono-wiki.litenext.digital/raindrop/01.me/2025-08-19-又一道-vibe-coding-面试题-基于注意力的-llm-幻觉检测器/01-me-img-002.png)

In the non-hallucination case, bright patches cluster in the system-prompt column when the model generates identity-card-style tokens — the spatial signature of grounded retrieval.

**Fig: 幻觉场景 1 — system-prompt attention heatmap (left portion)**

![幻觉场景 1: 热力图左侧部分，除了 system prompt 开头，注意力都很低](https://hirono-wiki.litenext.digital/raindrop/01.me/2025-08-19-又一道-vibe-coding-面试题-基于注意力的-llm-幻觉检测器/01-me-img-004.png)

In the hallucination case, the system-prompt column is nearly dark throughout; attention instead concentrates on the user-query region.

**Fig: 非幻觉 vs 幻觉 — per-token max-system-attention curves**

![非幻觉场景 1: 每个生成 token 在 system prompt 区域的注意力曲线](https://hirono-wiki.litenext.digital/raindrop/01.me/2025-08-19-又一道-vibe-coding-面试题-基于注意力的-llm-幻觉检测器/01-me-img-008.png)

![幻觉场景 1: 每个生成 token 在 system prompt 区域的注意力曲线](https://hirono-wiki.litenext.digital/raindrop/01.me/2025-08-19-又一道-vibe-coding-面试题-基于注意力的-llm-幻觉检测器/01-me-img-009.png)

Line charts plotting per-generated-token max system-prompt attention with the 10% threshold (red dashed line). Non-hallucination tokens consistently clear the threshold; hallucination tokens stay below it. These two charts are the direct empirical validation of the decision rule.

*Other images decorative or redundant — remaining heatmaps (imgs 001, 003, 005–007, 010–016) duplicate the same two qualitative patterns across a second test case; no additional signal beyond confirming cross-case stability.*

## Entities touched

[[Bojie Li]], [[Pine AI]], [[Qwen]]

## Topics touched

[[Minimal-Implementation Pedagogy]]

## Raw source

[01.me/2025/08/attention-based-hallucination-detection/](https://01.me/2025/08/attention-based-hallucination-detection/) — Chinese-language blog post by Bojie Li · 16 images (heatmaps + attention curves) · read 2026-05-15.
