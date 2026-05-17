---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/vYzJw1fLtVW6d5QjUsr8hQ
tags: [post-training, paper]
---

# [2026-01-04] DriveLaW：世界模型表征一统生成与规划（华科&小米）

## TL;DR

DriveLaW (HUST & Xiaomi) proposes chaining a video generation model (DriveLaW-Video) with a diffusion-based planner (DriveLaW-Act) via a shared latent space, rather than running them in parallel. By feeding intermediate Video DiT latents directly into the Action DiT, the planner exploits rich physical priors distilled from large-scale driving video. The model achieves 4.6 FID / 81.3 FVD on nuScenes video generation and **89.1 PDMS** on NAVSIM closed-loop planning — new SOTA without RL fine-tuning.

## Key claims

- DriveLaW replaces the conventional parallel generation+planning design (e.g., Epona, DriveVLA-W0) with a **chain structure**: DriveLaW-Video generates video first, then caches its intermediate DiT-block latents as conditioning signals for DriveLaW-Act.
- DriveLaW-Video uses a high-compression spatio-temporal VAE (compression ratio far above typical 4×8×8 or 4×4×4) encoding to a 128-channel causal latent space with 3D causal convolutions; a noise re-injection mechanism selectively adds noise to high-frequency regions at each denoising step to recover texture details.
- DriveLaW-Act is an Action DiT trained with flow-matching objectives; ablations show conditioning on **early denoising-step** latents outperforms late-step latents (+improvement in PDMS) because early latents are more abstract and less cluttered with pixel-level redundancy.
- VGM features outperform BEV features by **+5.0 PDMS** and VLM hidden states by **+2.6 PDMS** as conditioning for the diffusion planner under identical planning architectures.
- Three-stage progressive training: stage 1 at lower spatial resolution over long clips (learning temporal motion dynamics), stage 2 at higher resolution over shorter clips (refining spatial details), stage 3 jointly training DriveLaW-Act conditioned on Video DiT latents; omitting stage 1 degrades FVD significantly (temporal coherence lost) while omitting stage 2 mildly degrades FVD.
- Scaling the driving video pretraining corpus yields +3.2 PDMS improvement (full pretraining vs. no domain pretraining), indicating a scaling law for world-model-driven planning.
- On NAVSIM, DriveLaW (**89.1 PDMS**) exceeds Epona by +2.9, DriveVLA-W0 by +1.9, and PWM by +1.0, with no RL post-training or learned scoring.
- Paper: arXiv:2512.23421; code to be open-sourced at `wm-research/DriveLaW`.

## Visual observations

![](../../raw/raindrop/mp.weixin.qq.com/2026-01-04-超越drivevla-w0-drivelaw-世界模型表征一统生成与规划-华科-/weixin-img-001.png)
![](../../raw/raindrop/mp.weixin.qq.com/2026-01-04-超越drivevla-w0-drivelaw-世界模型表征一统生成与规划-华科-/weixin-img-004.png)
![](../../raw/raindrop/mp.weixin.qq.com/2026-01-04-超越drivevla-w0-drivelaw-世界模型表征一统生成与规划-华科-/weixin-img-005.png)

*Other images decorative — architecture diagrams and noise re-injection visualization (weixin-img-002, 003, 006–011) that are inline-described in body text.*

## What this changes

Demonstrates that chaining video generation latents into a diffusion planner (rather than running them in parallel) substantially outperforms prior unified world models on NAVSIM closed-loop planning, and that scaling driving video pretraining yields measurable planning-quality gains.

## Entities touched

[[VLA]], [[NAVSIM]]

## Topics touched

[[VLA for Autonomous Driving]]

## Raw source

[mp.weixin.qq.com/s/vYzJw1fLtVW6d5QjUsr8hQ](https://mp.weixin.qq.com/s/vYzJw1fLtVW6d5QjUsr8hQ) — WeChat public account 自动驾驶之心, summarizing arXiv:2512.23421 (DriveLaW, HUST & Xiaomi), published 2026-01-04. Read 2026-05-15.
