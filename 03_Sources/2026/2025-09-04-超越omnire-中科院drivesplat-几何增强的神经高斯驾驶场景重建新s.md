---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/PHVEA9NYDSg-DlPIhI3eng
tags: [training, paper]
---

# [2025-08-27] 超越OmniRe！中科院DriveSplat：几何增强的神经高斯驾驶场景重建新SOTA

## TL;DR

DriveSplat (arxiv 2508.15376) from the Chinese Academy of Sciences achieves SOTA novel-view synthesis on Waymo and KITTI driving datasets by combining neural Gaussian representations with a near-mid-far partitioned background optimization module, geometry priors from pretrained depth/normal estimators, deformable neural Gaussians for non-rigid actors, and dynamic-static decoupling — training a scene in 68 minutes on a single L20 GPU.

## Key claims

- DriveSplat partitions the static background into near/mid/far regions using PCA principal axis + Gaussian Mixture Model clustering, then applies adaptive octree-based voxel initialization with finer voxel sizes near the camera; this Background Partition Optimization (BPO) module improves NVS quality over vanilla Octree-GS (shown in ablation Table 4).
- Dynamic actors are tracked via bounding-box-derived transformation matrices (rotation R_t, translation T_t); non-rigid actors (pedestrians, cyclists) additionally use a deformable network that predicts time-varying position, scale, and rotation offsets — achieving comparable non-rigid reconstruction to OmniRe+SMPL without the SMPL dependency (Table 6).
- Geometry supervision uses DepthAnything-V2 (relative depth, correlation loss) and ZoeDepth (absolute/metric depth, L1 loss) plus a pretrained normal estimator; relative depth supervision improves render quality more than metric depth, though metric depth gives better absolute depth error (a quality–accuracy tradeoff noted in Table 5).
- Loss function: L_render (L1 + SSIM) + λ_d * L_depth (Pearson correlation) + λ_n * L_normal (L1 + cosine similarity) + λ_m * L_mask (cross-entropy for dynamic actor segmentation).
- On Waymo, DriveSplat outperforms all baselines on NVS PSNR/LPIPS/SSIM across standard and challenging ego-trajectory perturbation (±1m lateral, ±1m vertical) settings; StreetGS and OmniRe show weaker NVS performance despite strong reconstruction scores, indicating overfitting to training viewpoints.
- Initialization ablation (Table 3): SfM+LiDAR > SfM alone > LiDAR alone > DUSt3R (DUSt3R has scale/position misalignment issues despite denser points).
- Training efficiency: 68 min per scene at 30K iterations on one NVIDIA L20 vs >180 min for Desire-GS.

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-09-04-超越omnire-中科院drivesplat-几何增强的神经高斯驾驶场景重建新s/weixin-img-005.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-09-04-超越omnire-中科院drivesplat-几何增强的神经高斯驾驶场景重建新s/weixin-img-006.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-09-04-超越omnire-中科院drivesplat-几何增强的神经高斯驾驶场景重建新s/weixin-img-009.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-09-04-超越omnire-中科院drivesplat-几何增强的神经高斯驾驶场景重建新s/weixin-img-010.png)

*Other images decorative (promotional banners, community QR codes) or inline-described ablation tables.*

## Entities touched

[[3D Gaussian Splatting]], [[Waymo]]

## Topics touched

[[World Models for Autonomous Driving]], [[RL for Autonomous Driving]]

## Raw source

[mp.weixin.qq.com/s/PHVEA9NYDSg-DlPIhI3eng](https://mp.weixin.qq.com/s/PHVEA9NYDSg-DlPIhI3eng) — WeChat article by 自动驾驶之心, published 2025-08-27. Read 2026-05-16.
