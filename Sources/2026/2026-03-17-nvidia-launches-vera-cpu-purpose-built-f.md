---
created: 2026-03-17
updated: 2026-05-15
type: source
source_url: https://nvidianews.nvidia.com/news/nvidia-launches-vera-cpu-purpose-built-for-agentic-ai
tags: [inference, accelerator-design, announcement]
---

# [2026-03-17] NVIDIA Launches Vera CPU, Purpose-Built for Agentic AI

> 原文链接: https://nvidianews.nvidia.com/news/nvidia-launches-vera-cpu-purpose-built-for-agentic-ai

---

## TL;DR

NVIDIA launched the [[Vera CPU]] at GTC 2026 — a custom Arm-based processor with 88 NVIDIA-designed "Olympus" cores, purpose-built for the CPU-heavy workloads that agentic AI and reinforcement learning require: orchestration, tool dispatch, code execution, and data processing. Vera claims 2× the energy efficiency and 50% higher performance versus traditional rack-scale CPUs, backed by LPDDR5X memory at 1.2 TB/s bandwidth (2× prior-gen at half the power). The chip builds on the [[Grace CPU]] lineage, integrates with [[Rubin]] GPUs via NVLink-C2C at 1.8 TB/s coherent bandwidth, and ships via the [[NVIDIA MGX]] reference architecture. A new Vera rack hosts 256 liquid-cooled CPUs supporting >22,500 concurrent CPU environments; production availability is targeted for 2H 2026.

## Key claims

1. **Vera is framed as an architectural response to the "CPU is driving the model" thesis.** As agentic AI advances, Jensen Huang argues the CPU is no longer merely supporting GPU inference — it orchestrates planning, tool use, code execution, and validation. Vera is designed for this central coordinating role, not as a commodity host processor. — [[NVIDIA]]
2. **88 custom Olympus cores with NVIDIA Spatial Multithreading** — each core runs two tasks simultaneously for predictable, consistent throughput; optimized for compilers, runtime engines, analytics pipelines, and orchestration services in multi-tenant AI factories.
3. **Memory subsystem: LPDDR5X at 1.2 TB/s, 2× bandwidth at half the power** vs general-purpose CPUs. Vera introduces the second generation of NVIDIA's low-power memory subsystem, making high-bandwidth memory a per-CPU (not per-GPU) design principle.
4. **Vera + Rubin GPU integration via NVLink-C2C at 1.8 TB/s coherent bandwidth** — 7× the bandwidth of PCIe Gen 6. Within the [[Vera Rubin NVL72]] platform, Vera CPUs and Rubin GPUs share data with full cache coherence, enabling the CPU to act as an equal participant in inference pipelines rather than a PCIe-bottlenecked host.
5. **Vera rack: 256 liquid-cooled CPUs → >22,500 concurrent CPU environments** per rack, using the NVIDIA MGX modular reference architecture (80 ecosystem partners). New reference designs also pair Vera as the host CPU for HGX Rubin NVL8 GPU systems.
6. **Broad cloud and OEM adoption at launch**: Alibaba Cloud, ByteDance, CoreWeave, Cloudflare, Lambda, Meta, Nebius, Nscale, Oracle Cloud Infrastructure, Together.AI, Vultr — plus manufacturing from Dell, HPE, Lenovo, Supermicro, and a dozen ODMs. HPC deployments planned at TACC, LANL, LBNL/NERSC, and Leibniz Supercomputing Centre.
7. **Redpanda saw 5.5× lower latency** on Apache Kafka-compatible workloads on Vera vs benchmarked alternatives, attributed to Vera's higher memory bandwidth and lower overhead per core. TACC early tests on scientific applications confirmed "impressive" per-core performance and memory bandwidth gains.

## Visual observations

*No load-bearing images — source has no images (press release with one decorative hero image; all claims expressed in prose).*

## What this changes

- **CPU is now a first-class design axis in the NVIDIA platform**, not just a host accessory. The Vera launch signals that NVIDIA views agentic scaling as requiring custom silicon across the full server — GPU (Blackwell/Rubin), CPU (Vera), networking (ConnectX SuperNIC, BlueField-4 DPU), interconnect (NVLink-C2C), and chassis (MGX). This is a vertical integration play matching the scope of Google's AI Hypercomputer framing.
- **The 1.8 TB/s NVLink-C2C coherent CPU-GPU link** directly addresses the PCIe bandwidth ceiling that has limited CPU-side orchestration in agentic serving stacks. At this bandwidth, CPU-resident orchestrators can transfer KV caches, tool outputs, and activation checkpoints to/from GPU memory without becoming the bottleneck.

## Entities touched

[[NVIDIA]], [[Vera CPU]], [[Grace CPU]], [[Rubin]], [[Blackwell]], [[NVLink]]

## Topics touched

[[AI Accelerators]], [[Agentic AI Infrastructure]]

## Raw source

[nvidianews.nvidia.com](https://nvidianews.nvidia.com/news/nvidia-launches-vera-cpu-purpose-built-for-agentic-ai) — press release · ~1.5 KB body · plain HTML · no tables or code blocks · fetched 2026-03-17. Single decorative hero image (`nvidianews-img-001.png`).
