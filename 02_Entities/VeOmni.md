---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 5
tier: active
---

# VeOmni

ByteDance unified multi-modal training framework supporting LLM, VLM, and video generation (DiT) models at scale

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Open-sourced by [[ByteDance]] (Seed team + Volcano Engine ML Platform + IaaS); supports LLM, VLM, DiT T2V/I2V in a single framework with [[FSDP]], Ulysses, and Expert Parallel; achieves 40%+ throughput improvement over open-source baselines on [[Wan 2.1]]-14B LoRA (I2V 720P +48% compute-type, +59.5% bandwidth-type). — [[2025-08-06-字节跳动-veomni-框架开源-统一多模态训练效率飞跃]]
- Selective recompute ranks operators by ROI (MB saved per µs extra compute): `gate1_mul` saves 40 MB for 180 µs vs `down_proj`'s 4000 µs — 22× difference; using this to pick the top-ROI operators cuts recompute ratio from 60% to 30%. — [[2025-08-06-字节跳动-veomni-框架开源-统一多模态训练效率飞跃]]
