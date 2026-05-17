---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 1
tier: seen
---

# Lustre

High-performance parallel distributed file system widely used in HPC and AI cloud clusters

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- In a Xinnor/xiRAID Opus benchmark on virtualized GPU cluster, [[Lustre]] OSS backed by xiRAID Opus achieves 44 GB/s sequential read and 43 GB/s sequential write (1 MB blocks, 32 jobs) via multi-threaded vhost-user-blk; random read IOps ~2.8M and random write ~0.8M at IO depth 128 — lower than pNFS on same hardware. Virtio FS (virtiofsd daemon in Rust) simplifies client deployment by hiding Lustre complexity from VMs. — [[2025-05-26-高性能存储-ai云环境下的lustre与pnfs加速]]
