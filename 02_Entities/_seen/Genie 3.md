---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# Genie 3

Google DeepMind's general-purpose world model; pretrained on large-scale diverse video; generates highly realistic interactive 3D environments; foundational model for Waymo World Model

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Generates real-time interactive environments from text prompts at 24 fps / 720p, maintaining visual consistency for several minutes with visual memory reaching back up to one minute. — [[2026-02-08-genie-3-a-new-frontier-for-world-models]]
- "Promptable world events" allow text-driven mid-session changes (weather, new objects, characters); validated with the SIMA generalist agent for 3D virtual environments. — [[2026-02-08-genie-3-a-new-frontier-for-world-models]]
- Consistency is an emergent capability — no explicit 3D representation (unlike NeRF/Gaussian Splatting); worlds are generated frame-by-frame from description and actions. — [[2026-02-08-genie-3-a-new-frontier-for-world-models]]
- Waymo used Genie 3 as the base for Waymo World Model, applying a specialized post-training pipeline to transfer Genie 3's 2D video world knowledge into 3D LiDAR + camera outputs for autonomous driving simulation. — [[2026-02-07-waymo联手deepmind打造世界模型-基于genie-3-让自动驾驶-脑补]]
