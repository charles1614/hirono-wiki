---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/btT4bK6U6SJPqtZEOjjwqw
tags: [post-training, speculative-decoding, scheduling, inference]
---

# [2025-11-28] Moonshot Seer：长度感知+分段处理+投机采样=97%吞吐提升

## TL;DR

Seer (Moonshot AI + Tsinghua, arXiv:2511.14617) is a synchronous RL training system targeting the long-tail rollout problem. It combines three mechanisms — divided rollout (chunk-based generation with global KV cache pooling), context-aware length scheduling (online estimation of per-prompt-group response length), and adaptive grouped speculative sampling (suffix-tree draft server shared across group responses) — to deliver 74–97% end-to-end throughput improvement and 75–93% tail-latency reduction vs VeRL.

## Key claims

- **Divided Rollout**: splits each prompt's generation into fixed-size chunks (e.g., 64 tokens), sub-requests are tracked in a Request Buffer with Group ID / prompt length / max_tokens / current token count; rescheduled at chunk boundaries to the least-loaded inference instance, maintaining near-constant KV cache occupancy and eliminating preemption.
- A cross-instance global KV Cache Pool built on [[Mooncake]] (DRAM/SSD two-tier) stores KV tensors across divided requests; the pool proactively prefetches KV cache to the target instance based on queue information and releases it after rollout completes.
- **Context-aware scheduling**: each prompt group's first response is designated a Speculative Request, scheduled with Shortest-First Scheduling (SFS) to quickly establish a group-level length estimate Lg; remaining responses use Longest-First Scheduling (LFS) based on Lg, ensuring long groups are co-scheduled with short groups from the start.
- The scheduler additionally tracks per-group processing time and randomly selects the group with least elapsed time to prevent starvation caused by length estimation errors.
- **Adaptive grouped speculative sampling**: a distributed Grouped Draft Server maintains one Compressed Suffix Tree (CST) per prompt group, aggregating Token sequences from all in-flight responses; inference instances periodically pull CST deltas for their active groups and use them for local n-gram speculation; CST updates are asynchronous and non-blocking to forward passes.
- Draft length is dynamically adjusted: at tail stages with low concurrency, max_spec_tokens increases; beam search selects top-k paths by frequency within the CST; low-probability candidates are filtered.
- Evaluated on Qwen2-VL-72B (TP8), Kimi-K2 (DP32/EP32), and a third model; baseline is VeRL synchronous training; throughput gains: **74–97%**; tail-latency reduction: **75–93%**.
- Ablations show all three components (divided rollout, context-aware scheduling, speculative sampling) contribute individually across all tested models.
- Paper: arXiv:2511.14617; publication date of WeChat article 2025-11-28.

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-01-04-moonshot-seer-长度感知-分段处理-投机采样-97-吞吐提升/weixin-img-001.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-01-04-moonshot-seer-长度感知-分段处理-投机采样-97-吞吐提升/weixin-img-008.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-01-04-moonshot-seer-长度感知-分段处理-投机采样-97-吞吐提升/weixin-img-009.png)

*Other images decorative — architecture block diagrams and scheduling flow charts (weixin-img-002–007, 010–011) fully described in body text.*

## What this changes

Extends the emerging pattern of online-length-aware RL rollout optimization (SortedRL, Knapsack-RL, RollPacker) with a suffix-tree-based intra-group speculative decoding mechanism, showing that draft tokens derived from sibling responses in the same prompt group achieve competitive acceptance rates without a separate draft model.

## Entities touched

[[Moonshot AI]], [[Mooncake]], [[Speculative Decoding]], [[verl]], [[Kimi K2]]

## Topics touched

[[RL Post-Training]], [[Speculative Decoding]]

## Raw source

[mp.weixin.qq.com/s/btT4bK6U6SJPqtZEOjjwqw](https://mp.weixin.qq.com/s/btT4bK6U6SJPqtZEOjjwqw) — WeChat public account AI闲谈, summarizing arXiv:2511.14617 (Seer, Moonshot AI + Tsinghua), published 2025-11-28. Read 2026-05-15.
