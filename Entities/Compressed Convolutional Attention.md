---
created: 2026-05-17
updated: 2026-05-17
type: entity
refs: 8
tier: active
---

# Compressed Convolutional Attention

Zyphra attention variant: performs attention in compressed latent space with convolutional mixing on compressed Q/K; reduces KV cache AND prefill FLOPs

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Compressed Convolutional Attention (CCA), introduced by [[Zyphra]] (arXiv 2510.04476, Oct 2025), compresses Q, K, V and performs the attention operation directly in the compressed latent space — unlike [[MLA]] which stores compressed KV but decompresses into the head space for the actual attention. CCA reduces both KV cache size AND attention FLOPs during prefill/training. — [[2026-05-17-recent-developments-in-llm-architectures]]
- The "Convolutional" component is a sequence-mixing convolution applied only to the compressed Q and K tensors (not V), giving the narrower vectors local context before scoring; a channel-mixing convolution also exists. Used as the core attention module in [[ZAYA1-8B]] paired with a 4:1 [[GQA]] layout. The CCA paper reports outperforming [[MLA]] under comparable compression settings. — [[2026-05-17-recent-developments-in-llm-architectures]]
