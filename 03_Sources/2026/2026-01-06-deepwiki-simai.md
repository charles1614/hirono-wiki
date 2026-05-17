---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://wiki.litenext.digital/wiki/simai
tags: [training, inference, observability, tooling]
---

# [2026-01-04] SimAI Architecture Documentation

## TL;DR

DeepWiki-generated architecture documentation for SimAI, Alibaba Cloud's open-source full-stack simulator for large-scale AI training and inference. SimAI integrates five major components — AICB (workload generation), Astra-Sim (simulation engine), NS-3 (network simulation), Vidur (inference scheduler), and SimCCL (collective communication) — spanning three simulation fidelity modes: Analytical, Simulation (NS-3), and Physical.

## Key claims

- SimAI is maintained by Alibaba Cloud (repo: `aliyun/SimAI`) and published at NSDI'25 Spring as "Unifying Architecture Design and Performance Tuning for Large-Scale LLM Training with Scalability and Precision."
- The codebase spans **1,565 source files** (404 Python, 1,067 C++, 114 CMake) with 5 major documented subsystems across 15 documentation sections.
- Three simulation fidelity levels: Analytical (fast, no network modeling), Simulation (NS-3 packet-level), and Physical (real hardware measurement via AIOB kernel profiling).
- AICB generates training workloads compatible with Megatron, DeepSpeed, and DeepSeek parallelism strategies (TP/DP/PP/EP/SP), plus prefill/decode inference workloads.
- Astra-Sim is the core event-driven engine; it supports NCCL algorithm simulation and integrates with SimCCL for collective communication modeling.
- Vidur (originally from Microsoft) handles multi-request inference simulation with scheduling strategies including SplitWise, Sarathi-Serve, and prefill-decode disaggregation; metrics include TTFT, TBT, and end-to-end latency.
- Supported network topologies include Spectrum, Spectrum-X, HPN, and DCN+; topology files are generated via a parametric generator (GPU count, bandwidth, NVLink configurations).
- Seven documented usage scenarios range from AICB unit tests to SimAI-Analytical simulations to full multi-request inference runs with Vidur.

## Visual observations

*No load-bearing images — source has no images.*

## What this changes

Provides a structured index into SimAI's architecture for researchers studying LLM training/inference simulation infrastructure; confirms Alibaba's investment in full-stack simulation tooling as a complement to hardware benchmarking.

## Entities touched

[[SimAI]]

## Topics touched

[[Training Infrastructure]], [[LLM Inference Systems]]

## Raw source

[wiki.litenext.digital/wiki/simai](https://wiki.litenext.digital/wiki/simai) — DeepWiki auto-generated documentation for aliyun/SimAI, indexed 2026-01-04. Read 2026-05-15.
