---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://pdf.dfcfw.com/pdf/H3_AP202503221646031786_1.pdf?1742825646000.pdf
tags: [training, inference, observability, tooling]
---

# [2025-03-20] 基于eBPF和Agent构建LLM训练推理优化体系

## TL;DR

Slide deck (43 slides) from a 2024 AiDD AI+研发数字峰会 presentation outlining a system for LLM training and inference optimization built on eBPF kernel-level tracing and AI agents, covering observability, bottleneck detection, and automated tuning.

## Key claims

- The presentation proposes integrating eBPF (extended Berkeley Packet Filter) as a low-overhead, kernel-level observability substrate for LLM training and inference infrastructure, enabling profiling of GPU kernels, communication stacks, and memory without modifying application code.
- The proposed system uses AI agents to interpret eBPF trace data and autonomously recommend or apply optimizations to training pipelines, positioning agents as the decision layer above raw telemetry.
- Core covered topics span the full training-inference optimization lifecycle: identifying GPU utilization bottlenecks, communication stalls (NCCL/RDMA), memory pressure, and inference latency hotspots.

## Visual observations

![](../../raw/raindrop/pdf.dfcfw.com/2026-03-30-基于-ebpf-和-agent-构建llm-训练推理优化体系/2026-03-30-基于-ebpf-和-agent-构建llm-训练推理优化体系-slides/slide-001.png)
![](../../raw/raindrop/pdf.dfcfw.com/2026-03-30-基于-ebpf-和-agent-构建llm-训练推理优化体系/2026-03-30-基于-ebpf-和-agent-构建llm-训练推理优化体系-slides/slide-005.png)
![](../../raw/raindrop/pdf.dfcfw.com/2026-03-30-基于-ebpf-和-agent-构建llm-训练推理优化体系/2026-03-30-基于-ebpf-和-agent-构建llm-训练推理优化体系-slides/slide-010.png)
![](../../raw/raindrop/pdf.dfcfw.com/2026-03-30-基于-ebpf-和-agent-构建llm-训练推理优化体系/2026-03-30-基于-ebpf-和-agent-构建llm-训练推理优化体系-slides/slide-020.png)
![](../../raw/raindrop/pdf.dfcfw.com/2026-03-30-基于-ebpf-和-agent-构建llm-训练推理优化体系/2026-03-30-基于-ebpf-和-agent-构建llm-训练推理优化体系-slides/slide-035.png)

*Other images decorative — remaining 38 slides are supporting diagrams for the same eBPF+Agent architecture presented in these key slides.*

## Entities touched

[[NCCL]]

## Topics touched

[[Distributed-Serving Observability]], [[Training Infrastructure]], [[Communication-Computation Overlap]]

## Raw source

[pdf.dfcfw.com/pdf/H3_AP202503221646031786_1.pdf](https://pdf.dfcfw.com/pdf/H3_AP202503221646031786_1.pdf?1742825646000.pdf) — Slide deck, AiDD 计算机行业2024AI+研发数字峰会, 2025-03-20. Read 2026-05-16.
