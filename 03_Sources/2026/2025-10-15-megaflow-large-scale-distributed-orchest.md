---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://openreview.net/pdf?id=sIOgOQttFQ
tags: [training, post-training, paper, production-deployment]
---

# [2025-10-15] MegaFlow: Large-Scale Distributed Orchestration System for the Agentic Era

## TL;DR

MegaFlow is a three-service distributed orchestration system (Model Service, Agent Service, Environment Service) from Alibaba for training agents at scale on complex tasks like software engineering. Validated on over 2 million production executions, it achieves 32% cost reduction and consistent scaling to 10,000 concurrent tasks vs. centralized high-spec machines capped at 2,000.

## Key claims

- Three core bottlenecks motivate the architecture: cluster security policies block arbitrary containers; SWE-bench and SWE-Gym alone require >25 TB of container images; and containerized agent-environment interactions are so resource-intensive they limit centralized throughput to ~50 concurrent tasks per instance.
- MegaFlow's many-small-instances strategy (8-core, 16 GB, 100 Mbps each; 1 task/instance) vs. centralized (208-core, 3 TB, 1 Gbps; 50 concurrent tasks/instance): MegaFlow scales to 10,000 instances while centralized is hard-capped at 40 instances (2,000 concurrent tasks).
- Throughput: MegaFlow maintains ~100-minute execution time from 1 to 10,000 tasks; centralized degrades from 100 to 110 minutes even within its 2,000-task ceiling; environment startup time grows from 1 to 6 min (MegaFlow ephemeral) vs. 1 to 13 min (centralized) at 1,000 concurrent tasks.
- Cost: 32% reduction at 2,000 tasks ($1,005 vs. $1,470); advantages compound at larger scale.
- Hybrid execution: persistent mode (environment reused) achieves ~75-min total latency; ephemeral mode (fresh container per task) ~90 min; centralized ~110 min.
- Compatible with OpenHands, SWE-Agent, Mini-SWE-Agent, Qwen Code, and Claude Code across all evaluated benchmarks; built on Alibaba Cloud but APIs designed for migration to AWS/Azure/GCP.
- Evaluation uses bootstrap sampling (100 iterations/point, 95% CI) over 130,000 ephemeral and 2 million persistent production records.

## Visual observations

*No load-bearing images — figures inline-captioned in raw, no standalone images.*

## What this changes

Demonstrates that the agent training infrastructure bottleneck is orchestration (dynamic agent-environment coordination) not raw model compute; establishes that many-small-instances elastic cloud beats few-large-instances for cost and scale in RL agent training.

## Entities touched

[[MegaFlow]], [[Agentic AI Infrastructure]]

## Topics touched

[[Agentic AI Infrastructure]], [[RL Post-Training]], [[Training Infrastructure]]

## Raw source

[openreview.net/pdf?id=sIOgOQttFQ](https://openreview.net/pdf?id=sIOgOQttFQ) — OpenReview double-blind submission, anonymous authors, paper under review. Read 2026-05-16.
