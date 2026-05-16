---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://zhuanlan.zhihu.com/p/1898141047164507218
tags: [gpu-networking, distributed-systems, source-shape/blog, gpu-programming]
---

# [2025-04-22] 谈谈deepEP中的NVSHMEM

## TL;DR

A code-level walkthrough of how [[NVSHMEM]]'s IBRC transport mode underpins [[DeepEP]]'s expert communication, explaining QP connection setup, RMA put/get, and atomic memory operations (AMO) — and why the single-QP constraint is fundamental to correctness in the absence of CPU-side synchronization.

## Key claims

- [[NVSHMEM]] in IBRC mode replaces NCCL for bottom-level network communication in [[DeepEP]]; unlike NCCL's two-sided send/recv (with matching recv WQEs and pointer synchronization), NVSHMEM is fully one-sided: sender executes `put` directly into receiver's memory or receiver executes `get`, with no receiver-CPU involvement.
- Native NVSHMEM IBRC supports only a **single QP per PE pair**: RMA operations are unordered across QPs, so a trailing AMO (atomic memory operation used for synchronization) must arrive after all preceding RMA ops on the same QP; multi-QP breaks this ordering guarantee and causes data corruption.
- Connection setup: `nvshmemt_ibrc_connect_endpoints` builds QPs per PE × ep_count, performs bootstrap alltoall to exchange QP handles, then calls `ibv_connect`; despite creating `ep_count` QPs, only one is actually used (NVSHMEM source has dead/macro-wrapped code for the others).
- AMO operation (`nvshmemt_ibrc_amo`) selects the same QP as RMA, fills `ibv_send_wr` with `IBV_WR_ATOMIC_FETCH_AND_ADD`, and calls `ibv_post_send`; this AMO acts as the synchronization primitive that signals "all preceding puts to this PE are complete."
- This IBRC-based description is **distinct from [[IBGDA]]**: IBRC uses CPU proxy threads for doorbell writes; IBGDA eliminates the CPU from the control path entirely (GPU SM writes doorbell directly).

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[NVSHMEM]], [[DeepEP]], [[IBGDA]], [[NCCL]], [[DeepSeek-V3]]

## Topics touched

[[GPU Cluster Networking]], [[Expert Parallelism]], [[GPU Programming Models]]

## Raw source

[zhuanlan.zhihu.com/p/1898141047164507218](https://zhuanlan.zhihu.com/p/1898141047164507218) — Zhihu article, author: 做那自由的风, published 2025-04-22. Read 2026-05-16.
