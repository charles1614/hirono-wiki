---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/U9ZDBaKCcQ8dj1tD4_eWnQ
tags: [inference, data-loading]
---

# [2025-05-25] 高性能存储：AI云环境下的Lustre与pNFS加速

## TL;DR

Benchmark comparison of [[Lustre]] and [[pNFS]] parallel file systems accelerated by xiRAID Opus high-performance block storage in a virtualized GPU cluster environment, based on Xinnor / Sergey Platonov's SNIA SDC 2024 presentation. Both systems use vhost-user-blk for data path; [[pNFS]] shows superior random I/O scalability at high queue depths.

## Key claims

- Architecture 1 ([[Lustre]]): xiRAID Opus volumes serve as OSS (Object Storage Server) backends; VMs run Lustre clients communicating via LNET; Virtio FS (virtiofsd daemon in Rust) hides parallel FS complexity from guest VMs.
- Architecture 2 ([[pNFS]]): data path bypasses MDS entirely — VMs use vhost-user-blk to read/write xiRAID Opus volumes directly; NFS only for metadata operations.
- Lustre sequential performance: 44 GB/s read, 43 GB/s write (1 MB blocks, 32 jobs) — achieved via multi-threaded vhost-user-blk alone.
- pNFS sequential performance with xiRAID: 47 GB/s read (+35% vs bare pNFS 34.8 GB/s), 46 GB/s write (+40% vs bare pNFS 32.7 GB/s).
- Random I/O head-to-head at depth 128: pNFS ~3.4M IOps vs Lustre ~2.8M IOps random read; pNFS ~1.1M IOps vs ~0.8M IOps random write — pNFS scales more linearly with depth.
- [[pNFS]] limitation: open-source MDS is not production-ready, suitable only for POC deployments.
- pNFS client-side advantage: no third-party client software required (uses standard block interface).

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## What this changes

Provides concrete GB/s and IOps benchmarks for two xiRAID-backed parallel FS architectures in VMs, with practical guidance that pNFS outperforms Lustre on random I/O at high queue depth but has MDS maturity risk.

## Entities touched

[[Lustre]], [[pNFS]]

## Raw source

[mp.weixin.qq.com/s/U9ZDBaKCcQ8dj1tD4_eWnQ](https://mp.weixin.qq.com/s/U9ZDBaKCcQ8dj1tD4_eWnQ) — WeChat public account "王知鱼", published 2025-05-25. Slides from SNIA SDC 2024 presentation by Xinnor senior engineer Sergey Platonov. Read 2026-05-16.
