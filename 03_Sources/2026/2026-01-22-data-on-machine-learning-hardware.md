---
created: 2026-01-22
updated: 2026-05-15
type: source
source_url: https://epoch.ai/data/machine-learning-hardware#explore-the-data
tags: [accelerator-design, benchmark, gpu, survey]
---

# [2026-01-22] Data on Machine Learning Hardware

> 原文链接: https://epoch.ai/data/machine-learning-hardware#explore-the-data

---

## TL;DR

Epoch.ai's living dataset of 175 AI accelerators (updated May 7, 2026) — GPUs, TPUs, NPUs, and custom ASICs spanning the deep-learning era. Each row carries up to 39 columns: FP16/BF16 TFLOP/s, FP8 TFLOP/s, memory (bytes), memory bandwidth (bytes/s), and TDP (W), enabling direct cross-vendor spec comparison. The top tier is dominated by NVIDIA Blackwell Ultra (GB300/B300: 4.5–5.0 PFLOP/s FP8, 8 TB/s bandwidth) and Google TPU v7 Ironwood (4.61 PFLOP/s FP8, 7.37 TB/s). AMD's MI355X/MI350X match NVIDIA in raw FP8 compute (4.6 PFLOP/s) and memory bandwidth (8 TB/s) at the same TDP bracket. Non-NVIDIA challengers — Huawei Ascend 920, Amazon Trainium3, Meta MTIA 300 — are included but carry sparse FP8 and bandwidth specs, reflecting disclosure asymmetry rather than capability absence.

## Key claims

1. **NVIDIA holds the highest FP8 peak, but AMD is now spec-equivalent at the top.** [[NVIDIA]] GB300 reaches 5.0 PFLOP/s FP8 / 8 TB/s BW at 1400 W TDP; [[AMD]] MI355X matches 4.6 PFLOP/s / 8 TB/s at the same 1400 W. The gap has closed to the noise floor of spec sheets — differentiation moves to software ecosystem and supply.
2. **[[Google]] [[TPU]] v7 [[Ironwood]] is the highest-bandwidth TPU on record at 7.37 TB/s**, with 4.61 PFLOP/s FP8 and 192 GB HBM per chip. The dataset confirms the 960 W TDP — positioned as inference-first, not the most power-efficient per FLOP.
3. **[[Blackwell]] Ultra (GB300/B300, Aug 2025) raises the NVIDIA ceiling over GB200**: GB200 (Feb 2025) sat at 5.0 PFLOP/s FP8 / 8 TB/s; GB300 matches GB200 FP8 peak but adds 288 GB HBM (+55%) and drops to 1400 W vs 1200 W. B300 targets 4.5 PFLOP/s at 1100 W.
4. **[[Huawei Ascend]] 920 (Oct 2025) claims 900 TFLOP/s FP16/BF16** but lists no FP8 figure and no memory-bandwidth figure — consistent with China-export-control engineering tradeoffs and limited public disclosure. Ascend 910C (Oct 2024) at 800 TFLOP/s FP16 / 3.2 TB/s BW is the most data-complete Chinese AI chip in the set.
5. **[[Amazon Trainium]] Trainium3 (Dec 2025) is the most powerful non-NVIDIA/non-Google chip at 671 TFLOP/s FP16 / 2.52 PFLOP/s FP8**, but memory and bandwidth are not disclosed — making direct efficiency comparisons impossible. Trainium2 (Dec 2024) is more transparent: 667 TFLOP/s / 1.3 PFLOP/s FP8 / 96 GB / 2.9 TB/s at 500 W.
6. **[[Meta]] MTIA 300 (Mar 2026) is the first public Meta silicon at 600 TFLOP/s FP16 / 1.2 PFLOP/s FP8 / 6.1 TB/s BW**, with a 216 GB memory footprint at 800 W — unusual memory/BW ratio optimized for inference-at-Meta's-scale rather than raw FLOP/s.
7. **FP8 adoption is generationally bounded**: chips released before 2024 (A100, H100 SXM, TPU v4/v5p/v5e, older AMD) carry no FP8 column; FP8 becomes standard across all major vendors only from late-2024 releases onward, making it the dividing line between the "pre-Blackwell" and "Blackwell-era" hardware generations.

## Visual observations

*No load-bearing images — source has no images*

## What this changes

- **Fills the acknowledged sourcing gap in [[AI Accelerators]]**: the Topic explicitly flagged "AMD/AWS/Huawei competitive specs not yet sourced." This dataset provides the first citable numbers for AMD Instinct MI355X/MI350X/MI325X, Huawei Ascend 910C/920, Amazon Trainium2/3, and Meta MTIA 300.
- **The AMD-NVIDIA parity story is now citeable**: MI355X matches GB300 on FP8 TFLOP/s and memory bandwidth at the same TDP, which was previously only a claim in vendor press releases.

## Entities touched

[[NVIDIA]], [[Blackwell]], [[AMD]], [[Google]], [[TPU]], [[Ironwood]], [[Huawei Ascend]], [[Amazon Trainium]], [[Meta]], [[FP8]], [[BF16]]

## Topics touched

[[AI Accelerators]], [[Accelerator Economics]]

## Raw source

[epoch.ai/data/machine-learning-hardware](https://epoch.ai/data/machine-learning-hardware#explore-the-data) — living dataset, last updated May 7, 2026 · 175 rows × 39 columns (top 30 rows, 9 columns extracted) · CSV downloadable at epoch.ai/data/ml_hardware.csv.
