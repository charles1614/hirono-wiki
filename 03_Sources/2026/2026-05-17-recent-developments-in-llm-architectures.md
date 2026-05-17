---
created: 2026-05-17
updated: 2026-05-17
type: source
source_url: https://open.substack.com/pub/sebastianraschka/p/recent-developments-in-llm-architectures?r=6mlvz2&utm_medium=ios
tags: [inference, attention-kernels, kv-cache, moe, long-context, survey]
---

# [2026-05-17] Recent Developments in LLM Architectures: KV Sharing, mHC, and Compressed Attention

## TL;DR

Recent April–May 2026 open-weight releases ([[Gemma 4]], [[Laguna XS.2]], [[ZAYA1-8B]], [[DeepSeek-V4]]) all attack long-context inference cost through targeted transformer-block tweaks: cross-layer KV sharing, per-layer embeddings, layer-wise attention budgeting, latent-space attention with convolutional mixing, manifold-constrained hyper-connections, and sequence-length attention compression. None replace the transformer; each shaves KV-cache memory or attention FLOPs while leaving the decoder-only backbone intact.

## Key claims

- Gemma 4 E2B has 35 transformer layers but only the first 15 compute their own KV projections — the final 20 reuse KV tensors from the most-recent earlier non-shared layer of the same attention type (sliding-window or full); E4B has 42 layers with 24 own-KV and 18 sharing. This cross-layer KV sharing saves ~2.7 GB (E2B) and ~6 GB (E4B) at bfloat16 in 128K-context inference. Uses MQA (one-KV-head GQA) plus sliding-window in a 4:1 pattern. The technique traces to Brandon *et al.*, "Reducing Transformer KV Cache Size with Cross-Layer Attention" (NeurIPS 2024). See [[Cross-Layer Attention]], [[KV Cache]], [[GQA]], [[Sliding Window Attention]].
- Gemma 4 E2B and E4B add Per-Layer Embeddings (PLE): a packed embedding tensor with one slice per decoder layer, built by combining a per-layer embedding lookup with a linear projection of the normal token embeddings. The "E" in E2B/E4B means "effective" — E2B has 2.3B effective transformer-stack parameters but 5.1B total with embeddings; E4B is 4.5B effective / 8B total. Each block gates its PLE slice with the post-FFN hidden state, projects back to model hidden size, normalizes, and adds as an extra residual update. See [[Per-Layer Embeddings]], [[Gemma 4]].
- Laguna XS.2 (Poolside's first open-weight model) introduces per-layer query-head budgeting via a `num_attention_heads_per_layer` setting in `config.json`. 40 layers total — 30 sliding-window (window 512, 8 query heads per KV head) and 10 global/full attention (6 query heads per KV head), KV heads fixed at 8 throughout. Concept traces to Apple's 2024 OpenELM. Also uses per-head attention-output gating similar to Qwen3-Next. See [[Laguna XS.2]], [[Poolside]].
- ZAYA1-8B (Zyphra, trained on AMD GPUs) uses Compressed Convolutional Attention (CCA) with a 4:1 GQA layout. Unlike MLA, which compresses the per-token KV representation but performs attention in the head space, CCA performs attention directly in the compressed latent space — reducing both KV cache size AND attention FLOPs during prefill/training. A convolutional mixing step over compressed Q and K tensors (not V) gives the narrower vectors more local context before scoring. `config.json` lists 80 alternating CCA/MoE entries, conceptually 40 attention+MoE pairs. MoE is extremely sparse — one routed expert active per token. CCA paper: arXiv 2510.04476 (Oct 2025). See [[Compressed Convolutional Attention]], [[ZAYA1-8B]], [[Zyphra]], [[MLA]].
- DeepSeek V4 introduces two orthogonal changes: (1) manifold-constrained hyper-connections (mHC) on the residual path, and (2) a CSA/HCA hybrid on the attention path with compressed KV caches. mHC replaces the single residual stream with n=4 parallel streams plus learned Pre/Post/Res mappings; the manifold constraint projects Res-Mapping onto doubly stochastic matrices (non-negative, row/column sums to 1) and bounds Pre/Post Mappings non-negative, preventing signal amplification/cancellation across deep stacks. Optimized implementation adds only 6.7% training-time overhead at n=4 in the original 27B-scale mHC paper (arXiv 2512.24880, 31 Dec 2025). See [[Manifold-Constrained Hyper-Connections]], [[Hyper-Connections]], [[DeepSeek-V4]].
- DeepSeek V4 attention alternates CSA (Compressed Sparse Attention, mild compression rate m=4 + DSA-style sparse top-k selector) with HCA (Heavily Compressed Attention, m'=128 dense attention over the heavily compressed cache); both retain a 128-token sliding-window branch for recent uncompressed tokens. Unlike MLA (per-token representation compression keeping one entry per token), CSA/HCA compress along the *sequence* dimension — summarizing groups of tokens into fewer KV entries. Reported: at 1M-token context, DeepSeek V4-Pro uses 27% of single-token inference FLOPs and 10% of KV cache size vs DeepSeek V3.2; V4-Flash hits 10% FLOPs / 7% KV cache. See [[Compression Sparse Attention]], [[Highly Compressed Attention]], [[MLA]], [[DeepSeek-V3.2]].
- DeepSeek V4-Pro is the most parameter-sparse MoE among the surveyed 2026 models by active-parameter share. Caveat: active-parameter share ignores KV cache size, attention pattern, context length, routing overhead, and hardware efficiency. See [[DeepSeek-V4]], [[MoE]].
- Cross-cutting takeaway: all four 2026 architectures target long-context inference cost without shrinking total parameters. Gemma 4 reduces KV via cross-layer sharing + adds embedding capacity; Laguna varies attention capacity per layer; ZAYA1 moves attention into a compressed latent space; DeepSeek V4 widens the residual stream and compresses along the sequence axis. Modeling-quality gains remain dominated by data and training recipes; architecture tweaks are efficiency-focused. See [[LLM Architectures]].

## Visual observations

![](../../raw/raindrop/open.substack.com/2026-05-17-recent-developments-in-llm-architectures/substack-img-001.png)

*Figure 1 — side-by-side architecture diagrams of Gemma 4, Laguna XS.2, ZAYA1-8B, Qwen3.6, and DeepSeek V4-Pro, used as the article's map of which transformer-block components changed in each release.*

![](../../raw/raindrop/open.substack.com/2026-05-17-recent-developments-in-llm-architectures/substack-img-009.png)

*Figure 5 — KV cache memory savings from GQA + cross-layer KV sharing in a Gemma 4 E2B-like setup, showing the ~2.7 GB saving at 128K context.*

![](../../raw/raindrop/open.substack.com/2026-05-17-recent-developments-in-llm-architectures/substack-img-017.png)

*Figure 13 — MLA vs CCA side-by-side: MLA decompresses latent K/V before attention; CCA performs attention directly in the compressed latent space, then up-projects the output.*

![](../../raw/raindrop/open.substack.com/2026-05-17-recent-developments-in-llm-architectures/substack-img-024.png)

*Figure 20 — transformer block with hyper-connections (HC) vs manifold-constrained hyper-connections (mHC), showing the constrained Res/Pre/Post mappings between n=4 parallel residual streams.*

![](../../raw/raindrop/open.substack.com/2026-05-17-recent-developments-in-llm-architectures/substack-img-026.png)

*Figure 21 — conceptual comparison of MLA per-token latent caching vs CSA (m=4, sparse top-k) vs HCA (m'=128, dense attention over heavily compressed entries).*

*Other images decorative — section banners, related-article cards, GitHub repo screenshot, book cover.*

## What this changes

- "Long-context efficiency tax" is now the dominant motivator for 2026 open-weight architecture changes — KV cache size dictates the design space more than parameter count.
- Sequence-length compression (CSA/HCA) emerges as a third axis beyond per-token representation compression (MLA) and head-count reduction (GQA/MQA). Expect follow-on work mixing all three.

## Entities touched

[[Sebastian Raschka]], [[Gemma 4]], [[Gemma]], [[Laguna XS.2]], [[Poolside]], [[ZAYA1-8B]], [[Zyphra]], [[DeepSeek-V4]], [[DeepSeek-V3.2]], [[Cross-Layer Attention]], [[Per-Layer Embeddings]], [[Compressed Convolutional Attention]], [[Manifold-Constrained Hyper-Connections]], [[Hyper-Connections]], [[Compression Sparse Attention]], [[Highly Compressed Attention]], [[MLA]], [[GQA]], [[Sliding Window Attention]], [[KV Cache]], [[MoE]], [[OLMo]]

## Topics touched

[[LLM Architectures]], [[KV Cache Management]], [[Attention Kernels]]

## Raw source

[open.substack.com/pub/sebastianraschka/p/recent-developments-in-llm-architectures](https://open.substack.com/pub/sebastianraschka/p/recent-developments-in-llm-architectures?r=6mlvz2&utm_medium=ios) — Sebastian Raschka, PhD, 2026-05-17 Substack post. Read 2026-05-17.
