---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 1
tier: seen
---

# pNFS

Parallel NFS — extension to NFSv4.1 that separates data and metadata paths for high-performance parallel file access

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- [[pNFS]] backed by xiRAID Opus on virtualized GPU cluster: sequential read 47 GB/s (+35% vs bare pNFS 34.8 GB/s), sequential write 46 GB/s (+40% vs bare pNFS 32.7 GB/s); random read ~3.4M IOps vs Lustre ~2.8M IOps at depth 128; random write ~1.1M vs Lustre ~0.8M IOps — pNFS scales more linearly with queue depth. Client-side advantage: no third-party software needed. Current limitation: open-source MDS is POC-only, not production-ready. — [[2025-05-26-高性能存储-ai云环境下的lustre与pnfs加速]]
