---
created: 2026-05-12
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 1
---

# Pipeline Parallelism

## What

Splitting model layers across devices, with micro-batches flowing through in pipeline fashion to overlap compute.

## Current understanding

**Pipeline parallelism** (PP) is a model-parallelism strategy that partitions a neural network's layers into sequential **stages**, each assigned to one or more devices. During a forward pass, micro-batches flow through the stages in order; during the backward pass they flow in reverse. Because each stage processes a different micro-batch at any given moment, compute across devices can overlap — turning what would otherwise be dead-wait time into useful work.

The core tension in any pipeline schedule is the **pipeline bubble**: the fraction of device-time wasted at startup (fill) and teardown (drain) when stages have no micro-batch to process. With *F* stages and *M* micro-batches, the bubble ratio in the naive GPipe schedule is approximately *(F−1)/(M+F−1)*. Shrinking the bubble requires either increasing *M* (more micro-batches per batch, at a memory cost) or adopting a more sophisticated interleaved schedule.

**Interleaved (1F1B) schedules** — popularized by Megatron-LM — interleave forward and backward micro-steps so that a device begins its backward pass on micro-batch *k* before finishing forward on micro-batch *k+1*. This keeps the activation memory footprint bounded rather than growing with *M*, and reduces the steady-state bubble. Variants such as the **virtual pipeline** schedule further subdivide each stage into multiple model chunks per device, cutting the bubble at the cost of additional inter-device communication per micro-batch.

PP is almost always combined with **tensor parallelism** (TP) and **data parallelism** (DP) in the 3D-parallel configurations used to train large models (e.g., Megatron-LM, DeepSpeed, TorchTitan). The typical rule of thumb is: TP within a node (NVLink bandwidth), PP across nodes on the same inter-node fabric, DP across replica groups. The interaction between PP stage boundaries and gradient accumulation steps is a recurring source of off-by-one bugs and correctness issues in frameworks.

A practical consideration is **load balance**: stages must have roughly equal compute time, or the slowest stage bottlenecks the entire pipeline. Embedding and final-norm layers are often disproportionately light, requiring deliberate layer assignment or re-partitioning. **Memory balance** is a separate concern — the first and last stages hold optimizer states for their parameters plus, in 1F1B, activation checkpoints for in-flight micro-batches.

No cited Sources have been ingested for this topic yet; the above reflects general consensus from the distributed-training literature. Update once Sources are linked.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
