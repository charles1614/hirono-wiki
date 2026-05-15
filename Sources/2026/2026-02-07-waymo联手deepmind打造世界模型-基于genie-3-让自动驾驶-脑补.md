---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/ocy5vyXHgO0vDhmlnrx3Sg
tags: [inference, announcement, physical-ai]
---

# [2026-02-07] Waymo联手DeepMind打造世界模型：基于Genie 3，让自动驾驶「脑补」罕见场景

## TL;DR

Waymo launched the Waymo World Model, built on top of Google DeepMind's Genie 3 general-purpose world model, to generate highly realistic and interactive 3D driving simulations — including rare long-tail events like tornadoes and animal encounters — that real-world fleet data cannot cover. The model generates both camera images and LiDAR point clouds, and supports three controllability axes: driving behavior, scene layout, and natural language.

## Key claims

- [[Waymo World Model]] is built on [[Google]] [[DeepMind]]'s [[Genie 3]], which was pretrained on large-scale diverse video data, giving it world knowledge extending far beyond fleet-collected driving footage. — enables simulation of rare events the fleet never experienced
- The model transfers Genie 3's 2D video world knowledge into 3D LiDAR outputs via a specialized post-training pipeline, producing multi-sensor outputs (camera + LiDAR point cloud) jointly. — key technical contribution: 2D→3D modality transfer
- Three controllability mechanisms: (1) driving behavior control for counterfactual "what if" simulation; (2) scene layout control for custom road/traffic configurations; (3) language control for time-of-day, weather, and fully synthetic scene generation. — covers the main axes needed for safety-critical AV testing
- [[Waymo Driver]] has accumulated nearly 200 million fully autonomous miles; the World Model enables training on billions of simulated miles covering scenarios the real fleet has never encountered. — scale argument for synthetic data in AV development
- An efficient model variant supports long-horizon simulation at 4x speed while maintaining high realism and fidelity, enabling large-scale simulation pipelines. — practical production scalability

## Visual observations

*Image-heavy source (9 assets: 1 static diagram + 8 animated GIFs demonstrating simulation outputs). No load-bearing numerical charts — all visuals are qualitative simulation demos.*

## What this changes

Establishes a concrete case for using general-purpose video world models (trained on internet-scale video, not just fleet data) as a foundation for AV simulation. Prior AV simulation models trained exclusively on fleet data, limiting coverage of rare events. Genie 3's broad pretraining bridges that gap.

## Entities touched

[[Waymo]], [[DeepMind]], [[Google]], [[Genie 3]], [[Waymo World Model]], [[Waymo Driver]]

## Topics touched

[[Physical AI and Robotics]]

## Raw source

[mp.weixin.qq.com/2026-02-07-waymo联手deepmind打造世界模型-基于genie-3-让自动驾驶-脑补](https://mp.weixin.qq.com/s/ocy5vyXHgO0vDhmlnrx3Sg) — WeChat/机器之心 article, 2026-02-07. Read 2026-05-15.
