---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 5
tier: active
---

# MMCV

OpenMMLab foundational library for CV training (runners, ops, data pipelines)

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- `sigmoid_focal_loss_forward_impl` CUDA op registration fails at runtime on Volta GPUs with CUDA 11.0; fix is `MMCV_WITH_OPS=1 FORCE_CUDA=1 pip install mmcv==1.4.0` from the cu113/torch1.10.0 wheel index; as of 2024 the prebuilt wheels are no longer hosted, making source install the only recourse. — [[2025-08-09-runtimeerror-sigmoid_focal_loss_forward_]]
- PyTorch ≥ 2.1 changed `_get_stream` API to require a `torch.device` object instead of a raw int; patch adds `version.parse(torch.__version__) >= version.parse('2.1.0')` guard in `mmcv/parallel/_functions.py`. — [[2025-08-09-bugfix-get_stream-harboryuan-mmcv_16-ad1]]
