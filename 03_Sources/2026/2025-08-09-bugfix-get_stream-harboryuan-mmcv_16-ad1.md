---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://github.com/HarborYuan/mmcv_16/commit/ad1a72fe0cbeead2716706ff618dfa0269d2cf4c
tags: [training, tooling, gpu]
---

# [2023-11-29] bugfix get_stream — HarborYuan/mmcv_16 commit ad1a72f

## TL;DR

A one-line fix in `mmcv/parallel/_functions.py` adds a `torch.__version__` version guard so that `_get_stream` is called with a `torch.device("cuda", device)` object (required by PyTorch ≥ 2.1) instead of the raw integer device index used in older versions.

## Key claims

- `torch.nn.parallel._functions._get_stream` changed its API signature in PyTorch 2.1.0 to require a `torch.device` argument rather than a bare integer GPU index.
- The patch adds `from packaging import version` and branches on `version.parse(torch.__version__) >= version.parse('2.1.0')` within the CPU-to-GPU copy stream setup path in [[MMCV]]'s scatter implementation.
- Change is minimal: +6 / -1 lines across a single file; parent commit `b3f8526`.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[MMCV]], [[PyTorch]]

## Topics touched

[[Training Infrastructure]]

## Raw source

[github.com/HarborYuan/mmcv_16@ad1a72f](https://github.com/HarborYuan/mmcv_16/commit/ad1a72fe0cbeead2716706ff618dfa0269d2cf4c) — GitHub commit diff, authored HarborYuan, Nov 29 2023. Read 2026-05-15.
