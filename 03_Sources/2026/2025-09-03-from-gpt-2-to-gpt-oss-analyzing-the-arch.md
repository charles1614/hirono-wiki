---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://sebastianraschka.com/blog/2025/from-gpt-2-to-gpt-oss.html
tags: [training, evaluation, announcement]
---

# [2025-08-09] From GPT-2 to gpt-oss: Analyzing the Architectural Advances

## TL;DR

Sebastian Raschka's deep-dive comparing gpt-oss-20B and gpt-oss-120B to GPT-2 and Qwen3, covering seven architectural evolution points (no dropout, RoPE, SwiGLU/MoE, GQA, sliding window attention, RMSNorm) and three gpt-oss-specific design choices (MXFP4 quantization, attention bias+sinks, controllable reasoning effort).

## Key claims

- gpt-oss architecture changes from GPT-2: removed dropout (single-epoch training regime makes it harmful per Pythia 1.4B study, arXiv 2505.24788); RoPE instead of absolute positional embeddings (adopted with Llama 2023); SwiGLU instead of GELU (computationally slightly cheaper; GLU variants use 3 half-size weight matrices yielding fewer params but better expressivity than 2 full-size); MoE with 32 experts / 4 active (gpt-oss-20B), 128 experts / 4 active (120B); GQA instead of MHA; alternating full-attention and sliding-window-128-token GQA layers; RMSNorm instead of LayerNorm.
- Width vs depth: gpt-oss-20B is wider (embedding dim 2880 vs Qwen3-30B-A3B's 2048) but shallower (24 transformer blocks vs Qwen3's 48); Gemma 2 ablation finds wider slightly better than deeper at 9B scale (52.0 vs 50.8 average across 4 benchmarks).
- Sliding window of 128 tokens (alternating every other layer) is remarkably small — Gemma 2 used 4096, Gemma 3 reduced to 1024; gpt-oss also reportedly follows GPT-3's "locally banded sparse attention" precedent.
- MXFP4 quantization on MoE expert weights: gpt-oss-20B fits in 16 GB VRAM on RTX 50-series; gpt-oss-120B fits on a single H100 80GB; without MXFP4, bfloat16 would require 48GB / 240GB respectively; AMD MI300X supported from day 1.
- Attention bias and sinks: gpt-oss restores bias terms in Q/K/V projections (absent since GPT-2); sinks are implemented as per-head learned logit biases appended to attention scores (not actual tokens in sequence), stabilizing long-context attention without modifying inputs.
- Reasoning effort control: gpt-oss models accept "Reasoning effort: low/medium/high" in system prompt, controlling response length and accuracy; contrasts with Qwen3's now-deprecated hybrid thinking mode (abandoned in favor of separate Instruct/Thinking variants).
- Training compute: 2.1M H100-hours for gpt-oss-120B; ~10× less for gpt-oss-20B; comparable to DeepSeek-V3's 2.788M H800-hours for the ~5.6× larger model; gpt-oss includes both SFT and RL stages, DeepSeek-V3 is pretraining only.
- gpt-oss-120B is Apache 2.0, open-weight (weights + inference code, no training code or datasets); OpenAI explicitly labels it "open-weight" not "open-source" in the announcement.

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/sebastianraschka.com/2025-09-03-from-gpt-2-to-gpt-oss-analyzing-the-arch/sebastianraschka-img-002.png)
![](https://hirono-wiki.litenext.digital/raindrop/sebastianraschka.com/2025-09-03-from-gpt-2-to-gpt-oss-analyzing-the-arch/sebastianraschka-img-004.png)
![](https://hirono-wiki.litenext.digital/raindrop/sebastianraschka.com/2025-09-03-from-gpt-2-to-gpt-oss-analyzing-the-arch/sebastianraschka-img-016.png)
![](https://hirono-wiki.litenext.digital/raindrop/sebastianraschka.com/2025-09-03-from-gpt-2-to-gpt-oss-analyzing-the-arch/sebastianraschka-img-022.png)

*Other images decorative (activation plots, code snippets inline-described in body, benchmark tables paraphrased above).*

## Entities touched

[[Sebastian Raschka]], [[GQA]], [[RoPE]], [[RMSNorm]], [[SwiGLU]], [[MoE]], [[Qwen3]], [[OpenAI]], [[gpt-oss-20B]], [[DeepSeek-V3]]

## Topics touched

[[LLM Architectures]], [[LLM Open Source Ecosystem]], [[Quantization]], [[Low-Precision Training]], [[RL Post-Training]]

## Raw source

[sebastianraschka.com/blog/2025/from-gpt-2-to-gpt-oss.html](https://sebastianraschka.com/blog/2025/from-gpt-2-to-gpt-oss.html) — blog post by Sebastian Raschka PhD, published 2025-08-09. Read 2026-05-16.
