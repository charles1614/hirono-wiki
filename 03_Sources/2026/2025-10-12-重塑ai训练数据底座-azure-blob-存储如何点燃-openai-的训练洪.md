---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/gNe6ik4eA5Yecsv43zTbyg
tags: [training, data-loading, gpu]
---

# [2025-10-12] 重塑AI训练数据底座：Azure Blob 存储如何点燃 OpenAI 的训练洪流

## TL;DR

A technical deep-dive (MLSys2024 account) on how Microsoft redesigned [[Azure Blob Storage]] for EB-scale AI training with OpenAI. The core shift: from a mixed-use object store to a single-purpose AI data infrastructure with Scaled Storage Accounts, automated tiering, and [[BlobFuse]] delivering 8.1 Tbps write / 13.5 Tbps read from 16,800 concurrent vCPUs.

## Key claims

- Training at EB scale generates two dominant workloads: raw training data (small files, KB–MB, billions of objects) and checkpoints (large sequential files written every 5–15 minutes, cumulative PB-scale); both exceed single-account limits of traditional Blob Storage.
- Microsoft's "Thundering Herd" AI supercomputer architecture: single-purpose data centers with only GPU racks + Blob Storage racks, interconnected via RDMA over RNG (Regional Network Gateway) across multiple global facilities forming a unified namespace.
- Scaled Storage Accounts (Scaled Blob Storage Account): logically one account, physically a distributed storage grid — removes per-account bandwidth/capacity ceilings, enables tens of TB/s throughput per account.
- [[BlobFuse]] FUSE layer mounts [[Azure Blob Storage]] as a POSIX filesystem; uses local NVMe (36 TB on NV5 H100 nodes) + pinned memory as block-level cache; demonstrated 8.1 Tbps write and 13.5 Tbps read at 16,800 vCPUs — not cache hits, real Blob Storage throughput.
- Automated cold/hot tiering via last-access-time + last-modified-time metadata policies auto-purges stale checkpoints, reclaiming capacity without manual ops.

## Visual observations

![](../../raw/raindrop/mp.weixin.qq.com/2025-10-12-重塑ai训练数据底座-azure-blob-存储如何点燃-openai-的训练洪/weixin-img-005.png)
![](../../raw/raindrop/mp.weixin.qq.com/2025-10-12-重塑ai训练数据底座-azure-blob-存储如何点燃-openai-的训练洪/weixin-img-007.png)
![](../../raw/raindrop/mp.weixin.qq.com/2025-10-12-重塑ai训练数据底座-azure-blob-存储如何点燃-openai-的训练洪/weixin-img-010.png)

*Other images decorative — architectural diagrams described fully in body.*

## Entities touched

[[Microsoft]], [[Azure Blob Storage]], [[BlobFuse]]

## Topics touched

[[Data Loading Pipelines]], [[AI Data Centers]], [[LLM Training Systems]]

## Raw source

[mp.weixin.qq.com/s/gNe6ik4eA5Yecsv43zTbyg](https://mp.weixin.qq.com/s/gNe6ik4eA5Yecsv43zTbyg) — MLSys2024 WeChat article, published 2025-10-12. Read 2026-05-15.
