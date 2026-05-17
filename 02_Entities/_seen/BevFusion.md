---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# BevFusion

multi-modal 3D object detection framework combining camera and LiDAR for autonomous driving

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Training the LiDAR-only TransFusion detector with `voxelnet_0p075.yaml` triggers `sigmoid_focal_loss_forward_impl: implementation for device cuda:0 not found` on CUDA 11.0 / Volta V100 due to mismatched [[MMCV]] CUDA op compilation; resolved by upgrading host CUDA to 11.8 or rebuilding mmcv with `MMCV_WITH_OPS=1 FORCE_CUDA=1`. — [[2025-08-09-runtimeerror-sigmoid_focal_loss_forward_]]
