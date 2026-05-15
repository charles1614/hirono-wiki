---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 4
tier: active
---

# BlobFuse

Microsoft's FUSE-based layer that mounts Azure Blob Storage as a POSIX filesystem for AI training nodes

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- FUSE layer mounting [[Azure Blob Storage]] as POSIX filesystem for GPU training nodes; on NV5 H100 nodes (8×H100, 36 TB NVMe) uses local RAM + NVMe block-level cache; measured 8.1 Tbps write and 13.5 Tbps read at 16,800 vCPU concurrent access — not cache hits, real Blob Storage throughput; future roadmap: prefetching + inter-node distributed cache over InfiniBand. — [[2025-10-12-重塑ai训练数据底座-azure-blob-存储如何点燃-openai-的训练洪]]
