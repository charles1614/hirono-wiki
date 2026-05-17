---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://github.com/vllm-project/vLLM-in-PyTorch-Conference-2025
tags: [inference, tooling]
---

# [2025-12-14] vLLM at PyTorch Conference 2025 — Curated Talk Index

## TL;DR

A community-curated index of 53 out of 117 PyTorch Conference 2025 talks that mention vLLM (~45% of all sessions). Covers keynotes, sponsored sessions, and lightning talks spanning inference serving, disaggregated inference, KV cache scaling, RL training with vLLM, and cross-accelerator deployment.

## Key claims

- At least 53 of 117 total PyTorch Conference 2025 videos mention [[vLLM]], representing roughly 45% of all sessions.
- A dedicated keynote (#3) covers vLLM & DeepSpeed updates by Simon Mo and Tunji Ruwase.
- Session #44 ("vLLM: Easy, Fast, and Cheap LLM Serving for Everyone") is a standalone vLLM talk by Simon Mo.
- Session #35 covers vLLM hardware optionality across cloud providers (Spotify + Google), and session #81 covers multi-accelerator PyTorch serving with NxD Inference and vLLM on Amazon.
- Session #69 addresses enabling vLLM V1 on AMD GPUs with Triton (IBM Research + AMD), indicating active non-NVIDIA accelerator support.
- Session #37 presents an open-source post-training stack pairing Kubernetes + [[Ray]] + [[PyTorch]] + vLLM (Robert Nishihara, Anyscale).
- Session #60 ("No GPU Left Behind") covers co-located vLLM in TRL for online LLM training at scale.
- Session #83 covers scaling KV caches for LLMs using LMCache + NIXL for network and storage heterogeneity.
- Session #74 addresses long-tail and [[MoE]] challenges in RL with [[SGLang]] (Chenyang Zhao, UCLA).
- Session #78 covers disaggregated inference with Kubernetes and llm-d by Serving PyTorch LLMs at scale.

## Visual observations

*No load-bearing images — source has no images.*

## What this changes

Signals that vLLM has become the de facto inference backend referenced across the PyTorch ecosystem, with cross-accelerator support (AMD, AWS Trainium, NVIDIA) and integration into RL training pipelines as a major emerging theme.

## Entities touched

[[vLLM]], [[PyTorch]], [[Ray]], [[SGLang]], [[MoE]]

## Topics touched

[[Inference Disaggregation]]

## Raw source

[github.com/vllm-project/vLLM-in-PyTorch-Conference-2025](https://github.com/vllm-project/vLLM-in-PyTorch-Conference-2025) — community GitHub repo (README index); date from slug. Read 2026-05-15.
