---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/g2xFPa6ZUzfD2yWyDYMFwg
tags: [post-training, training]
---

# [2026-03-13] EvoDriveVLA：通过蒸馏进化VLA，感知规划不再割裂

## TL;DR
Peking University and XPeng jointly propose EvoDriveVLA, a knowledge distillation framework for autonomous driving VLA models that addresses two failure modes: visual encoder degradation when unfrozen during SFT, and trajectory instability during long-horizon planning. The framework uses a self-anchored visual distillation module and an oracle-guided trajectory distillation module, achieving SOTA on nuScenes open-loop and NAVSIM closed-loop benchmarks.

## Key claims
- Unfreezing the visual encoder during SFT degrades general visual representations while potentially improving domain fit — EvoDriveVLA resolves this via a self-anchored teacher model (a frozen copy of the student's encoder before fine-tuning) that supplies trajectory-guided token-level anchoring constraints. — [[VLA]]
- The AnchorFormer module assigns per-token adaptive anchor weights based on trajectory-relevant spatial regions, applying stronger anchoring to areas relevant to predicted waypoints. — raw source
- An Oracle teacher model uses privileged future information (future-second images and ego-state) to produce dramatically better trajectory predictions than a standard teacher trained on the same data as the student. — [[VLA]]
- A coarse-to-fine trajectory optimization loop refines the Oracle teacher's trajectory iteratively, combined with MC-Dropout sampling (dropout rate 0.1) to produce a diverse high-quality candidate set for distillation soft targets. — raw source
- EvoDriveVLA achieves current best performance on nuScenes open-loop evaluation and significantly improves closed-loop performance on NAVSIM. — raw source
- The framework is described as not directly used in VLA 2.0 but the methodology is transferable. — raw source

## Visual observations
*Architecture and result figures are SVG diagrams (mathematical notation) — no load-bearing photographic or chart images beyond the equation diagrams already described in the text.*

## What this changes
Establishes that self-anchored distillation (using a frozen pre-SFT encoder as teacher) is an effective technique for preserving pre-training visual representations during downstream VLA fine-tuning — relevant to [[Physical AI and Robotics]] distillation practices.

## Entities touched
[[VLA]]

## Topics touched
[[Physical AI and Robotics]], [[RL Post-Training]]

## Raw source
[mp.weixin.qq.com/2026-03-13-小鹏刘先明挂名工作-evodrivevla-通过蒸馏进化vla-感知规划不再割裂](https://mp.weixin.qq.com/s/g2xFPa6ZUzfD2yWyDYMFwg) — WeChat public article, 9,632 chars, 17 images + 42 SVG diagrams. Read 2026-05-15.
