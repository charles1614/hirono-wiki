---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# mmdetection

OpenMMLab object detection framework built on MMCV, providing 2D detection algorithms

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- [[BevFusion]] depends on mmdetection==2.20.0 and [[MMCV]]==1.4.0; version mismatches manifest as CUDA op registration failures on older GPU architectures (Volta/CUDA 11.0). — [[2025-08-09-runtimeerror-sigmoid_focal_loss_forward_]]
