---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://www.fibermall.com/blog/nvidia-b100-b200-gh200-nvl72-superpod.htm?srsltid=AfmBOorNLgqAQTISTjy565uxFmIk9n1dp1Rgbe7BSL_JPrzBU0QQKxXt
tags: [inference, gpu, accelerator-design, announcement]
---

# [2024-03-29] Analysis of NVIDIA's Latest Hardware: B100/B200/GH200/NVL72/SuperPod

## TL;DR

Comprehensive technical breakdown of NVIDIA's Blackwell GPU family (B100, B200, GB200) and system configurations (NVL72, GB200 SuperPod) released March 2024, comparing compute, memory, and interconnect specs against Hopper predecessors. Corrects common misconceptions about acceleration ratios and clarifies die packaging, NVLink generations, and TCO implications.

## Key claims

- The Blackwell GPU is a dual-die package (208B transistors, TSMC 4N) yielding ~2.5× H100 FP16 dense compute; GB200 pairs one Grace CPU with 2 Blackwell dies at 1200W, 384 GB HBM3e + 480 GB LPDDR5X = 864 GB total fast memory.
- B200 (HGX variant) reaches 4.5P sparse FP16; 8×B200 = 36P, approximately 2.25× 8×H100/H200; B100 is ~3/4 of B200 compute (28P for 8×B100).
- [[Blackwell]] adds FP6 and FP4 Tensor Core support; FP4 = 2× FP8 = 4× FP16 dense throughput; CUDA Cores drop INT8 support starting Hopper.
- [[NVLink]] Gen 5 doubles per-port bandwidth from 50 GB/s (Gen 4, H100) to 100 GB/s; each GPU retains 18 NVLink ports → 1.8 TB/s max GPU-to-GPU; 4th-gen [[NVSwitch]] supports up to 576 GPUs at 1 PB/s aggregate.
- [[GB200]] NVL72 holds 18 Compute Trays (36 Grace CPUs, 72 Blackwell GPUs), 9 NVSwitch Trays; 13.8 TB HBM3e + 17 TB LPDDR5X = ~30 TB fast memory; cabinet power 120 kW vs. NVL32 40 kW.
- GB200 SuperPod = 8 NVL72 = 576 GPUs; requires 144 L1 + 72 L2 NVSwitch Trays for full 1 PB/s NVLink fabric.
- Jensen Huang GTC data: 3× training speedup (GPT-MoE-1.8T, 4096 HGX B200 vs. 4096 HGX H100); 15× inference speedup on 8 systems (3.5 → 58 tokens/s); FP4+NVL72 full interconnect drives the outsized inference ratio.
- HGX B100/B200 retain ConnectX-7 IB (400 Gb/s); NVL72 and GB200 SuperPod use ConnectX-8 (800 Gb/s) + Quantum-X800 IB switches (144 × 800 Gb/s ports).

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/www.fibermall.com/2026-01-12-analysis-of-nvidia-s-latest-hardware-b10/default-img-002.png)
![](https://hirono-wiki.litenext.digital/raindrop/www.fibermall.com/2026-01-12-analysis-of-nvidia-s-latest-hardware-b10/default-img-006.png)
![](https://hirono-wiki.litenext.digital/raindrop/www.fibermall.com/2026-01-12-analysis-of-nvidia-s-latest-hardware-b10/default-img-036.png)
![](https://hirono-wiki.litenext.digital/raindrop/www.fibermall.com/2026-01-12-analysis-of-nvidia-s-latest-hardware-b10/default-img-045.png)

*Other images decorative — product photos, network switch chassis shots, related-posts thumbnails.*

## What this changes

Corrects the common claim of "dozens-of-times" Blackwell speedup: raw FP16 dense compute is ~2.25× H100 per 8-GPU system; the 15× inference figure is specifically FP4 on NVL72 full fabric with MoE-1.8T, not a general ratio.

## Entities touched

[[Blackwell]], [[GB200]], [[B200]], [[NVLink]], [[NVFP4]], [[FP8]], [[H100]], [[H200]], [[Hopper]], [[A100]], [[NVIDIA]]

## Topics touched

[[LLM Inference Systems]], [[LLM Training Systems]]

## Raw source

[fibermall.com/blog/nvidia-b100-b200-gh200-nvl72-superpod](https://www.fibermall.com/blog/nvidia-b100-b200-gh200-nvl72-superpod.htm) — blog post by Casey, fibermall.com, 2024-03-29. Read 2026-05-15.
