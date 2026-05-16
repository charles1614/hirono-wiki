---
created: 2026-05-15
updated: 2026-05-16
type: entity
refs: 3
tier: active
---

# 3D Gaussian Splatting

Scene representation technique using 3D Gaussian primitives for real-time novel view synthesis

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- DGGT（清华+小米）将3D Gaussian Splatting扩展到4D动态驾驶场景：每个像素输出Gaussian参数（颜色/位置/旋转/尺度/不透明度），结合lifespan head建模时间维度可见性，motion head预测像素级3D运动轨迹；支持在Gaussian层面直接进行实例级操作（新增/删除/平移车辆行人），扩散精修自动补洞，使3DGS成为"可编辑4D场景资产生成器"。 — [[2025-12-10-清华-小米最新dggt-0-4秒完成4d自驾高斯重建-性能提升50]]
- DriveSplat (CAS, arXiv 2508.15376) extends neural Gaussian representation to large-scale driving scene reconstruction with dynamic-static decoupling; novel contributions: near-mid-far partitioned BPO module via PCA+GMM, deformable neural Gaussians for non-rigid actors, DepthAnything-V2/ZoeDepth + normal prior supervision; achieves SOTA NVS on Waymo and KITTI in 68 min per scene on one L20 GPU vs >180 min for Desire-GS. — [[2025-09-04-超越omnire-中科院drivesplat-几何增强的神经高斯驾驶场景重建新s]]
- DrivingSphere (Li Auto, CVPR 2025) uses 3D Gaussian / occupancy-grid-based 4D world representation (S_city + agents + pose sequences); OccDreamer generates city-scale static scenes from BEV map + text prompts via VQVAE tokenization + ControlNet-driven diffusion + iterative scene extension; VideoDreamer synthesizes high-fidelity multi-view video from 4D occupancy using ST-DiT with view-aware spatial self-attention. — [[2025-09-04-理想汽车智驾方案介绍-4-world-model-强化学习重建自动驾驶交互环境]]
