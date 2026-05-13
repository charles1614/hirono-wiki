---
created: 2026-05-12
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 1
---

# Vertical Integration

## What

Co-design across silicon, networking, and software stack — Google's TPU + Pathways + JAX + XLA versus the merchant-silicon strategy.

## Current understanding

No sources have been ingested into this Topic yet, so the current understanding is limited to the framing captured at Topic creation.

The central tension this Topic tracks is the **co-design thesis**: whether owning the full stack — silicon, interconnect, compiler, runtime, and model framework — produces compounding advantages that a merchant-silicon strategy cannot match. Google's bet is the affirmative: TPU generations are co-designed with XLA (the compiler), JAX (the numerical framework), and Pathways (the multi-controller runtime), so optimisations at any layer can be exploited at every other layer without negotiating with an external vendor.

The **merchant-silicon strategy** (NVIDIA + CUDA + cuDNN + cuBLAS + NCCL, or AMD/Intel variants) decouples hardware from software: customers get hardware earlier and at volume, and the software ecosystem is shared across buyers, but no single buyer can co-evolve the stack end-to-end.

Key load-bearing questions this Topic should answer as sources accumulate:

- **Efficiency gap**: Do vertically-integrated systems achieve meaningfully higher FLOP/s utilisation or lower cost-per-token at scale, and is the gap widening or narrowing?
- **Portability cost**: What does Google pay in model-portability terms by being JAX/XLA-first when the broader research ecosystem is PyTorch-first?
- **Replication risk**: Can hyperscalers (Amazon Trainium/Inferentia, Microsoft Maia, Meta MTIA) replicate the co-design advantage, or is TPU's multi-generation lead durable?
- **Network fabric**: To what extent does the vertical integration extend into the interconnect layer (ICI for TPUs), and how does that interact with the software stack?

_(Stub — populate with Sources citations as sources accumulate.)_

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
