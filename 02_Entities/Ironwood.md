---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 12
tier: active
---

# Ironwood

Google's seventh-generation TPU (TPU v7), inference-optimized, GA Nov 2025; 4,614 TFLOPS/chip, 192 GB HBM, 9,216-chip pods at 42.5 EFLOPS.

## Synthesis

*Regenerated from Observations below.*

## Observations

- Epoch.ai spec dataset confirms Ironwood (TPU v7, Nov 2025) at 2.31 PFLOP/s FP16/BF16 / 4.61 PFLOP/s FP8 / 192 GB HBM / 7.37 TB/s bandwidth / 960 W TDP — highest bandwidth of any TPU generation and highest memory capacity of any chip in the top-30 set outside Blackwell Ultra. [[AI Accelerators]] Topic previously carried these as uncited estimates; now citeable. — [[2026-01-22-data-on-machine-learning-hardware]]
- SemiAnalysis TCO model: all-in Ironwood cost ~44% lower than GB200 server from [[Google]]'s procurement perspective (despite [[Broadcom]]'s margin on silicon). For [[Anthropic]] GCP rental at $1.60/hr/chip, the advantage narrows to ~30% lower than GB200 and ~41% lower than GB300. MFU breakeven: Anthropic needs only 19% extracted MFU (vs GB300 at 30%) to match costs; at projected 40% Anthropic MFU, TCO per effective PFLOP is ~52% lower than GB300. — [[2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro]]
- Rack architecture: each 64-chip rack is a 4×4×4 3D torus; copper traces for interior neighbors, 800G optical transceivers for cube-face connections to OCS; 1.5 optical transceivers per TPU average attach ratio. Liquid cooling from TPUv3 (2018); flow rate actively controlled per-chip workload. Rack design simpler than [[Blackwell]] Oberon NVL72 backplane; scale-up connections entirely external copper/optics. — [[2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro]]
- Chip vs Blackwell spec delta: FLOPs and memory bandwidth trail GB200 ~10%; HBM capacity same 8-Hi HBM3E = 192 GB (significant shortfall vs GB300 288 GB 12-Hi HBM3E); GA ~1 year after Blackwell. Nvidia's marketed peak FLOPs inflated by DVFS — Blackwell reaches 70s% of rated peak in practice, while TPU FLOPs are conservatively rated; SemiAnalysis concludes Ironwood can exceed Blackwell's realized MFU. — [[2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro]]
- Google's primary-source announcement (Google Cloud Next '25, Apr 9 2025): first TPU purpose-built for inference ("age of inference" framing — proactive agents rather than real-time response); two pod configs (256 chips and 9,216 chips → 42.5 EFLOPS, claimed >24× El Capitan); native FP8 (vs emulated on v4/v5p); enhanced [[SparseCore]] extends to financial/scientific domains beyond ranking/recommendation; liquid cooling mandatory at 9,216-chip ~10 MW scale. [[Pathways]] runtime composes hundreds of thousands of chips across pods. — [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]
