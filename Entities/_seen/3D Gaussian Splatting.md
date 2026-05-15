---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# 3D Gaussian Splatting

Scene representation technique using 3D Gaussian primitives for real-time novel view synthesis

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- DGGT（清华+小米）将3D Gaussian Splatting扩展到4D动态驾驶场景：每个像素输出Gaussian参数（颜色/位置/旋转/尺度/不透明度），结合lifespan head建模时间维度可见性，motion head预测像素级3D运动轨迹；支持在Gaussian层面直接进行实例级操作（新增/删除/平移车辆行人），扩散精修自动补洞，使3DGS成为"可编辑4D场景资产生成器"。 — [[2025-12-10-清华-小米最新dggt-0-4秒完成4d自驾高斯重建-性能提升50]]
