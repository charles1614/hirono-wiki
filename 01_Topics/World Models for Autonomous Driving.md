---
created: 2026-05-16
updated: 2026-05-16
type: topic
source_count: 4
---

# World Models for Autonomous Driving

## What

Using generative world models for simulating driving scenes, trajectory planning, and data synthesis in autonomous driving

## Current understanding

_(stub — populate as sources accumulate. `topic-content-gaps` will lint-warn once source_count ≥ 3.)_

## Open threads

## Sources drawn on

- [[2025-09-17-分钟级长视频生成-地平线epona-自回归扩散式的端到端自动驾驶世界模型-icc]] — Epona自回归扩散世界模型：Chain-of-Forward训练策略+解耦时空建模，分钟级长视频生成与实时规划
- [[2025-09-17-华为-理想-特斯拉-商汤的世界模型是做什么用的]] — 全景综述：世界模型作为训练型仿真；商汤/华为/地平线长时序路线 vs 理想3D渲染路线；视频质量评估指标与行业格局

## Observations

- DrivingSphere (Li Auto, CVPR 2025) is the first geometry-prior-enhanced generative closed-loop simulation framework: solves open-loop's lack of dynamic feedback and game-engine simulation's visual realism gap by combining 3D reconstruction (occupancy grid) with generative video synthesis; city-scale static scene generation via OccDreamer (VQVAE tokenizer + BEV/text-conditioned diffusion + iterative extension); multi-view video via VideoDreamer (ST-DiT with VSSA + temporal self-attention + agent ID/position Fourier encoding). — [[2025-09-04-理想汽车智驾方案介绍-4-world-model-强化学习重建自动驾驶交互环境]]
- DriveSplat (CAS, arXiv 2508.15376) achieves SOTA novel-view synthesis for driving scenes on Waymo and KITTI: near-mid-far background partition optimization + deformable neural Gaussians for non-rigid actors + DepthAnything-V2/ZoeDepth/normal-estimator supervision; key ablation: relative depth supervision improves render quality while absolute depth gives better depth accuracy (tradeoff); SfM+LiDAR initialization outperforms DUSt3R (scale/alignment issues). — [[2025-09-04-超越omnire-中科院drivesplat-几何增强的神经高斯驾驶场景重建新s]]
