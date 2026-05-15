---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://wiki.litenext.digital/wiki/flashmla?file=05-attention-algorithms
tags: [inference, attention-kernels, gpu, tooling, long-context]
---

# [2026-01-30] FlashMLA Attention Algorithms (DeepWiki doc 05)

## TL;DR

DeepWiki-generated reference for FlashMLA's attention algorithm layer: MLA (128-head MQA in latent space), DeepSeek Sparse Attention (DSA, O(topk) compute), online softmax, seesaw scheduling, and log-sum-exp split-KV combination. Documents the mathematical foundations and hardware rationale for each design choice.

## Key claims

- [[FlashMLA]] implements [[MLA]] as 128 query heads sharing a single KV head (MQA pattern); `d_qk = 576` (512 NoPE + 64 RoPE), `d_v = 512`; KVCache per token is 2 × 576 bytes (BF16) vs. 2 × h_kv × d bytes for standard MHA — roughly 128× memory reduction vs. full MHA.
- MLA decoding on [[H800]] is compute-bound: FLOPs/byte ratio ≈ 242 (278,528 × s_k FLOPs vs. 1,152 × s_k bytes), near H800's crossover threshold of ~258 (865 TFlops / 3.35 TB/s). This makes Tensor Core utilization — not HBM bandwidth — the optimization target.
- DeepSeek Sparse Attention (DSA) reduces computation from O(seq_len) to O(topk) by attending only to selected token positions via an `indices` tensor; variable topk per query is supported via a `topk_length` field; an optional `attn_sink` mechanism preserves attention to special tokens outside the sparse selection.
- Online softmax increments over KV blocks without storing the full attention matrix: tracks running max `m` and running sum `l`, rescales the output accumulator on each block update — mathematically equivalent to standard softmax.
- Seesaw scheduling solves the register-budget constraint: 64×512 output = 32,768 registers = half SM capacity, preventing a second output matrix for ping-pong. Solution: split output vertically into O_L / O_R, two warpgroups process two KV blocks simultaneously with cross-update in phases 3–4. Achieves ~80% Tensor Core utilization of throttled H800 peak.
- Split-KV combination uses log-sum-exp reduction: each SM produces partial (O_i, LSE_i); global LSE = logsumexp over all partials; rescale factor alpha_i = exp(LSE_i − global_lse); final output = weighted sum. Scales to arbitrarily long sequences.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[FlashMLA]], [[MLA]], [[H800]], [[DeepSeek]], [[CUDA]], [[Hopper]]

## Topics touched

[[Attention Kernels]], [[GPU Kernel Scheduling]], [[KV Cache Management]]

## Raw source

[wiki.litenext.digital/wiki/flashmla?file=05-attention-algorithms](https://wiki.litenext.digital/wiki/flashmla?file=05-attention-algorithms) — DeepWiki-generated architecture doc, FlashMLA commit 48c6dc4, generated 2026-01-27. Read 2026-05-15.
