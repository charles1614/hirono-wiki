---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# DGGT

Tsinghua & Xiaomi pose-free feed-forward 4D dynamic driving scene reconstruction model using 3D Gaussians

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- DGGT（清华+小米，2025-12-08）：pose-free feed-forward 4D动态驾驶场景重建框架，ViT编码器融合DINO先验，六头并行输出（相机/Gaussian/lifespan/动态/运动/天空），0.39秒完成单场景20帧多视角重建；Waymo上PSNR 27.41/SSIM 0.846/EPE_3D 0.183m；零样本泛化nuScenes LPIPS −61.4%、Argoverse2 −52.5%；去lifespan后PSNR从27.41降至24.21（−3.2 dB）；支持3D Gaussian层面实例级编辑+单步扩散精修。 — [[2025-12-10-清华-小米最新dggt-0-4秒完成4d自驾高斯重建-性能提升50]]
