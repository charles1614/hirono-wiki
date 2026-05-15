---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://www.nvidia.com/en-us/data-center/vera-rubin-nvl72/
tags: [inference, training, accelerator-design, announcement]
---

# [2026-01-26] NVIDIA Vera Rubin NVL72 — Co-Designed Infrastructure for Agentic AI

## TL;DR

NVIDIA's Vera Rubin NVL72 is a rack-scale AI supercomputer combining 72 Rubin GPUs, 36 Vera CPUs, ConnectX-9 SuperNICs, and BlueField-4 DPUs on the third-generation MGX NVL72 rack. It delivers 3,600 PFLOPS NVFP4 inference and 2,520 PFLOPS NVFP4 training per rack, claims 1/4 the GPUs for training and 1/10 the cost per token for inference versus Blackwell, and is now in full production.

## Key claims

- Rubin NVL72 spec per GPU: 50 PFLOPS NVFP4 inference, 35 PFLOPS NVFP4 training, 17.5 PFLOPS FP8/FP6 training, 4 PFLOPS FP16/BF16, 288 GB HBM4 at 22 TB/s bandwidth, 3.6 TB/s NVLink bandwidth (NVLink 6). [[Rubin]] [[NVFP4]] [[Vera Rubin NVL72]] [[NVLink]]
- Full rack (72 GPUs + 36 Vera CPUs): 3,600 PFLOPS NVFP4 inference, 20.7 TB HBM4, 1,580 TB/s HBM4 bandwidth, 260 TB/s NVLink, 54 TB LPDDR5X CPU memory, 3,168 custom Olympus (Arm-compatible) CPU cores. [[Vera Rubin NVL72]] [[Vera CPU]]
- NVIDIA Groq 3 LPX rack (256 LPUs, 128 GB SRAM each, 40 PB/s memory bandwidth, 640 TB/s scale-up bandwidth) is co-designed as the inference accelerator for Vera Rubin NVL72; delivers 35× inference performance per watt and up to 10× revenue opportunity versus Blackwell for trillion-parameter models. [[Groq LPU]] [[Vera Rubin NVL72]]
- Compared to Blackwell, Rubin trains MoE models with 1/4 the GPUs (10T MoE, 100T tokens, 1-month timeframe) and achieves 1/10 cost per million tokens for agentic inference (Kimi-K2-Thinking, 32K/8K ISL/OSL benchmark). [[Rubin]] [[Blackwell]] [[MoE]]
- Spectrum-X Ethernet scale-out with integrated silicon photonics claims 5× better power efficiency, 10× higher network resiliency, and up to 5× more uptime over pluggable-transceiver networking. [[Rubin]]
- ConnectX-9 SuperNICs: 1.6 Tb/s per-GPU bandwidth with programmable RDMA; BlueField-4 DPUs cover storage, networking, cybersecurity, and elastic scaling. [[Vera Rubin NVL72]]

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## Entities touched

[[Rubin]], [[Vera Rubin NVL72]], [[Vera CPU]], [[NVFP4]], [[NVLink]], [[Blackwell]], [[MoE]], [[Groq LPU]]

## Topics touched

[[AI Accelerators]], [[Accelerator Economics]], [[Inference-Optimized Accelerators]], [[AI Data Centers]]

## Raw source

[nvidia.com/en-us/data-center/vera-rubin-nvl72](https://www.nvidia.com/en-us/data-center/vera-rubin-nvl72/) — NVIDIA product page, _default site module, 2026-01-26. Read 2026-05-15.
