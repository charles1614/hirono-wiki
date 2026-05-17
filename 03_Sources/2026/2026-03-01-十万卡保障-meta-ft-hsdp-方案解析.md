---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/CtoxhE9rSPyqGyVGTuSIQA
tags: [training, parallelism, training-resilience]
---

# [2026-02-28] 十万卡保障：Meta FT-HSDP 方案解析

## TL;DR
Meta's FT-HSDP (Fault Tolerant Hybrid-Shared Data Parallelism) treats each DP replica as the fault recovery unit at 100K-GPU scale, cutting stall time from ~10 min to ~3 min per failure event and raising effective training time from 44% to 80%. A custom CPU+GPU FTAR protocol replaces NCCL for cross-datacenter gradient AllReduce, and a non-blocking catch-up protocol lets a recovered replica rejoin without halting healthy replicas.

## Key claims
- At 98K GPU scale, synchronous training failures occur every 18 min with 10 min recovery → only 44% effective training time; [[Meta]] FT-HSDP raises this to ~80%.- [[Meta]] uses 12 replicas of 8,192 GPUs each for its 98K-GPU runs; replica size trades memory pressure against recovery scope.- HBM3 memory errors are the leading fault category (22.9%); hardware-related faults constitute 78% of all training interruptions at this scale.- NCCL initialization time scales from 17 s (16K GPUs) to 200 s (98K GPUs), making it a dominant component of cold-restart latency.- FTAR uses a CPU control plane (RDMA init, reconfig, congestion control) and GPU data plane (send/reduce), overlapping inter-replica gradient exchange with the backward pass.- A 2PC-style barrier before optimizer step ensures that a replica that didn't complete gradient exchange retries the forward+backward rather than skipping ahead, allowing intentional step-number divergence across replicas.- The non-blocking catch-up protocol has a lagging replica send zero gradients during FTAR and fetch the healthy replica's checkpoint; total fetch latency must be less than one training step.- Cross-DC-Building bandwidth convergence ratio in Meta's new fabric is 1:2.8 (improved from 1:7 in LLaMA 3's original design).- NVIDIA's NTP approach (non-uniform TP + dynamic rack power reallocation) is cited as an alternative paradigm; FT-HSDP is targeted at scenarios with larger DP replicas and cross-DC topology.- Simulation tooling replaces GPU compute with CPU mock and replaces comms with CPU primitives, enabling large-scale validation before real 100K-GPU runs.
## Visual observations
*10 local images (weixin-img-001.png through weixin-img-010.png): hardware fault breakdown table, NCCL/init scaling charts, multi-DC Clos network diagrams, HSDP vs FSDP topology, FTAR protocol flow, 2PC consistency diagram, and non-blocking catch-up sequence. Charts show empirical data; numbers cited above come from prose, not image OCR.*

## What this changes
FT-HSDP demonstrates that asynchronous replica-level fault recovery (step-number divergence explicitly allowed) is mathematically non-equivalent to synchronous training but does not degrade model quality in practice. This justifies approximate-synchronous training as a viable production strategy at scale.

## Entities touched
[[Meta]], [[Llama]], [[NCCL]], [[PyTorch]]

## Topics touched
[[Training Infrastructure]], [[LLM Pretraining]], [[Parallelism Strategies]]

## Raw source
[mp.weixin.qq.com/2026-03-01-十万卡保障-meta-ft-hsdp-方案解析](https://mp.weixin.qq.com/s/CtoxhE9rSPyqGyVGTuSIQA) — WeChat公众号 "AI闲谈", published 2026-02-28. Read 2026-05-15.
