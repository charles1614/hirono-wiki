---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://blog.briankitano.com/llama-from-scratch
tags: [training, minimal-impl, attention-kernels]
---

# [2023-08-09] Llama from Scratch (or How to Implement a Paper Without Crying)

## TL;DR

Brian Kitano's step-by-step pedagogical tutorial building a scaled-down [[Llama]] model on TinyShakespeare (~1M chars), incrementally adding [[RMSNorm]], [[RoPE]] rotary embeddings, [[SwiGLU]], and causal masking, going from validation loss 3.94 → 1.0 over training.

## Key claims

- Start with a working base model before adding paper-specific components; iterative build-and-test is more reliable than top-down assembly — even the minimal feed-forward model must remove the softmax before `F.cross_entropy` to avoid a critical bug (loss stalls at 3.94 vs 2.5 after fix).
- [[RMSNorm]] as pre-normalization reduces loss from 2.5 to 2.50 (marginal), but stabilizes gradients; the [[RoPE]] rotary embedding test property `x_m @ x_n == x @ R[n-m] @ y` is directly verifiable and serves as a unit test.
- Omitting the causal mask causes attention to be fully unmasked — model "cheats" by attending to future tokens, driving validation loss to 0.16 (essentially memorizing), which looks deceptively good but generates incoherent text.
- Adding 4 LlamaBlock layers with [[RoPE]] masked multi-head attention and [[SwiGLU]] drives validation loss to 1.0 (equivalent to choosing among ~2.7 tokens), with ~2.37M parameters.
- Cosine annealing LR schedule from the Llama paper performed *worse* than plain Adam in the author's experiments on TinyShakespeare — the lesson is to experiment rather than copy hyperparams wholesale.
- Use `.shape` assertions and `plt.imshow` on attention weights proactively; gradient flow check (`show_grads`) should confirm nearly all parameters have non-zero gradients.

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## Entities touched

[[Llama]], [[RoPE]], [[RMSNorm]], [[SwiGLU]], [[PyTorch]]

## Raw source

[blog.briankitano.com/llama-from-scratch](https://blog.briankitano.com/llama-from-scratch) — blog post by Brian Kitano, published 2023-08-09. Read 2026-05-16.
