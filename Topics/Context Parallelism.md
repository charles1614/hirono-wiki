---
created: 2026-05-12
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 1
---

# Context Parallelism

## What

Parallelism strategy that splits input sequences into segments across devices, enabling very long sequence-length training.

## Current understanding

**Context Parallelism (CP)** is a distributed training parallelism strategy that partitions the input sequence dimension across devices, rather than partitioning model parameters (tensor parallelism) or layers (pipeline parallelism). Each device holds the full model for its assigned layer slice but sees only a contiguous segment of the sequence; attention across segment boundaries is handled via inter-device communication (typically an all-gather over key/value tensors before the attention kernel, then a scatter of the output).

The core motivation is **sequence-length scalability**: activations in transformer attention grow quadratically with sequence length, so single-device memory becomes the binding constraint for very long contexts (100 K+ tokens). CP distributes that activation memory linearly across the CP degree without requiring the model to be sharded more aggressively along the parameter axis.

CP is almost always composed with other parallelism axes. In Megatron-LM and similar frameworks it appears as a fourth axis alongside Data Parallelism, Tensor Parallelism, and Pipeline Parallelism (the 4-D or "DTCP" factorization). Sequence chunks within a CP rank are themselves processed with full TP; gradients are reduced across the DP group as normal. This composability means CP degree can be tuned independently to match the target sequence length and the available HBM budget per node.

The principal implementation challenge is the **ring-attention / all-gather pattern**: naively all-gathering KV before every attention layer adds communication volume proportional to sequence length × hidden dim × num_layers. Efficient implementations (ring attention, sequence-parallel attention) pipeline the communication with computation to hide latency. Causal masking requires careful load-balancing so that later tokens (which attend to more context) do not leave early-rank devices idle.

No sources are cited in this Topic yet; the above reflects established consensus from the broader distributed-training literature and will be refined as Sources accumulate.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
