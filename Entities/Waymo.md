---
created: 2026-05-15
updated: 2026-05-16
type: entity
refs: 3
tier: active
---

# Waymo

Alphabet subsidiary; autonomous vehicle company operating Waymo Driver in US cities; ~200M fully autonomous miles as of early 2026

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- DGGT（清华+小米，2025-12-08）在Waymo上训练后实现零样本跨数据集泛化：PSNR 27.41/SSIM 0.846/EPE_3D 0.183m；pose-free设计（相机位姿作为模型输出而非输入）是零样本泛化的关键，消除了对特定数据集相机配置和采集路径的过拟合风险。 — [[2025-12-10-清华-小米最新dggt-0-4秒完成4d自驾高斯重建-性能提升50]]
- Waymo World Model (built on Genie 3) enables multi-sensor simulation of rare long-tail AV scenarios (tornadoes, animals, wrong-way vehicles) that real fleet data cannot cover; supports camera + LiDAR output and three controllability axes: driving behavior, scene layout, and language. — [[2026-02-07-waymo联手deepmind打造世界模型-基于genie-3-让自动驾驶-脑补]]
- DriveSplat (CAS, arXiv 2508.15376) achieves SOTA NVS PSNR/LPIPS/SSIM on Waymo (8 diverse sequences) across both training-view reconstruction and challenging ego-trajectory perturbation settings (±1m lateral, ±1m vertical); outperforms StreetGS and OmniRe on NVS despite those methods showing stronger reconstruction scores — highlighting their overfitting to training viewpoints. — [[2025-09-04-超越omnire-中科院drivesplat-几何增强的神经高斯驾驶场景重建新s]]
