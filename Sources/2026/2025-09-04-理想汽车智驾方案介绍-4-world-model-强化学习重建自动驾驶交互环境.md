---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/5ID-YEEH79cbzEe8aqbnSw
tags: [training, post-training]
---

# [2025-09-01] 理想汽车智驾方案介绍4：World Model + 强化学习重建自动驾驶交互环境

## TL;DR

The fourth installment in Li Auto's autonomous driving series describes their strategy for closed-loop RL simulation using DrivingSphere — a 4D world model that combines 3D reconstruction-based geometry with generative video synthesis, enabling city-scale scene generation from text+BEV prompts with closed-loop agent interaction feedback.

## Key claims

- Li Auto identifies two blockers for effective RL in autonomous driving: (1) lack of end-to-end trainable in-car architecture (solved by VLA), and (2) lack of realistic closed-loop 3D interactive environments (addressed by DrivingSphere and related CVPR 2025 works: StreetCrafter, DrivingSphere, DriveDreamer4D, ReconDreamer).
- The proposed solution combines 3D reconstruction as foundation + view-perturbation-based generative training: real-data reconstruction provides geometry; then noisy-view training on that reconstruction teaches the generator to synthesize multi-view consistent frames, giving the generative model multi-viewpoint capability.
- DrivingSphere's 4D world representation: W = {S_city, {A_n}, {P_n}} where S_city is a static background occupancy grid, A_n are dynamic agents, and P_n are spatio-temporal position sequences; all stored as occupancy grids for unified modeling.
- OccDreamer (3-stage architecture within DrivingSphere): VQVAE occupancy tokenizer (CE + Lovász loss) → BEV-map + CLIP text embedding + ControlNet for region generation → scene extension via overlapping mask conditioning for city-scale spatial consistency.
- VideoDreamer synthesizes high-fidelity multi-view video from 4D occupancy using Spatial-Temporal Diffusion Transformer (ST-DiT) with view-aware spatial self-attention (VSSA merging view+height+width dims), temporal self-attention, cross-attention for agent ID/position (Fourier encoding), and T5 text embeddings for agent descriptions.
- Closed-loop feedback: agent actions directly perturb the simulated environment (steering → nearby vehicles react), forming a real-time "agent action → environment response" loop with multi-agent traffic simulation; supports "simulate → test → fix" iteration to surface edge-case failures.
- Prior open-loop simulation lacks dynamic feedback; game-engine-based closed-loop lacks visual realism; DrivingSphere uniquely combines both via geometry-prior-enhanced generation.

## Visual observations

![](../../raw/raindrop/mp.weixin.qq.com/2025-09-04-理想汽车智驾方案介绍-4-world-model-强化学习重建自动驾驶交互环境/weixin-img-003.jpg)
![](../../raw/raindrop/mp.weixin.qq.com/2025-09-04-理想汽车智驾方案介绍-4-world-model-强化学习重建自动驾驶交互环境/weixin-img-005.jpg)
![](../../raw/raindrop/mp.weixin.qq.com/2025-09-04-理想汽车智驾方案介绍-4-world-model-强化学习重建自动驾驶交互环境/weixin-img-006.jpg)

*Other images decorative (series header, human-driving comparison chart inline-described in body).*

## Entities touched

[[3D Gaussian Splatting]]

## Topics touched

[[World Models for Autonomous Driving]], [[VLA for Autonomous Driving]], [[RL for Autonomous Driving]]

## Raw source

[mp.weixin.qq.com/s/5ID-YEEH79cbzEe8aqbnSw](https://mp.weixin.qq.com/s/5ID-YEEH79cbzEe8aqbnSw) — WeChat article by 地平线开发者, published 2025-09-01. Read 2026-05-16.
