---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 6
tier: active
---

# Azure Blob Storage

Microsoft's cloud object-storage service, scaled for EB-level AI training workloads

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Redesigned for OpenAI's EB-scale training: traditional single-account limits (tens of GB/s, billions of objects) far exceeded; Scaled Storage Accounts create a physically distributed grid behind a single logical account enabling tens of TB/s throughput; automated cold/hot tiering via last-access-time purges stale checkpoints; cold-start (cross-training-job resume) requires reading all checkpoint shards from all GPUs simultaneously, establishing the peak read watermark. — [[2025-10-12-重塑ai训练数据底座-azure-blob-存储如何点燃-openai-的训练洪]]
