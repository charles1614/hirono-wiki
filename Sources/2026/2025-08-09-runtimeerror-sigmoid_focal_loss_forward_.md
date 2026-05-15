---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://github.com/mit-han-lab/bevfusion/issues/228
tags: [training, gpu, tooling]
---

# [2022-11-14] RuntimeError: sigmoid_focal_loss_forward_impl — BevFusion Issue #228

## TL;DR

Users training BevFusion's LiDAR-only TransFusion detector hit a `sigmoid_focal_loss_forward_impl: implementation for device cuda:0 not found` error caused by a mismatch between the host CUDA version (11.0/Volta) and the mmcv ops library. Upgrading the host to CUDA 11.8 or reinstalling mmcv with `MMCV_WITH_OPS=1 FORCE_CUDA=1` resolved it.

## Key claims

- Error occurs specifically on the LiDAR-only `voxelnet_0p075.yaml` training config while other configs run fine, pointing to a focal-loss CUDA op registration issue.
- Root cause is an [[MMCV]] version mismatch: confirmed fix requires `mmcv==1.4.0` and `mmcv-full==1.4.0` installed with `python setup.py develop` from the repo root.
- CUDA 11.0 on Volta (V100) GPUs was not supported by the bundled mmcv wheels; upgrading host CUDA to 11.8 resolved the issue for multiple users.
- Alternative fix (BigGold0202, 2023): reinstall mmcv with `MMCV_WITH_OPS=1 FORCE_CUDA=1 pip install mmcv==1.4.0 -f https://download.openmmlab.com/mmcv/dist/cu113/torch1.10.0/index.html` — forces CUDA 11.3 compilation; verified on A100 host CUDA 11.4.
- As of early 2024, the mmcv 1.4.0 prebuilt wheels are no longer hosted at `download.openmmlab.com`; source installation becomes the only recourse.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[BevFusion]], [[MMCV]], [[mmdetection]]

## Topics touched

[[Training Infrastructure]]

## Raw source

[github.com/mit-han-lab/bevfusion/issues/228](https://github.com/mit-han-lab/bevfusion/issues/228) — GitHub issue, multi-commenter, closed Dec 27 2022. Read 2026-05-15.
