---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://deepmind.google/blog/genie-3-a-new-frontier-for-world-models/
tags: [world-models, generative-video, embodied-ai]
---

# [2025-08-05] Genie 3: A new frontier for world models

## TL;DR
Google DeepMind announced Genie 3, a general-purpose world model that generates interactive environments from text prompts at 24 fps and 720p, maintaining visual consistency for several minutes. It is the first Genie model to support real-time interaction and introduces "promptable world events" for mid-session environmental changes.

## Key claims
- Genie 3 generates real-time interactive environments at 24 fps / 720p with consistency maintained for several minutes, with visual memory reaching back up to one minute.
- A comparison table in the post shows Genie 3 advances over GameNGen, Genie 2, and Veo across control, resolution, and interaction latency dimensions.
- Consistency is described as an emergent capability — unlike NeRFs or Gaussian Splatting, Genie 3 maintains environmental coherence without an explicit 3D representation.
- "Promptable world events" allow text-driven mid-session changes (weather, new objects, characters), enabling counterfactual scenario generation for agent training.
- Genie 3 worlds were validated with the SIMA agent (a generalist 3D virtual environment agent); the agent was instructed to pursue goals while Genie 3 simulated responses to actions.
- Current limitations: constrained action space (agents cannot directly perform all prompted events), inability to simulate real-world locations with geographic accuracy, text rendering requires explicit prompting, and continuous interaction limited to a few minutes.
- Launched as a limited research preview to a small cohort of academics and creators; broader access is planned.

## Visual observations
*No load-bearing images — video frames and comparison table screenshots are illustrative of capabilities rather than quantitative; the comparison table is described in the post but not readable from static images.*

## What this changes
Genie 3 marks the first step toward using generative world models as unlimited training environments for embodied agents — a key gap in the path to AGI per DeepMind's framing. Previous world models (Genie 1, Genie 2) could generate environments but not support real-time interaction.

## Entities touched
[[Google]], [[Genie 3]]

## Topics touched
[[Physical AI and Robotics]], [[Agentic AI Infrastructure]]

## Raw source
[deepmind.google/2026-02-08-genie-3](https://deepmind.google/blog/genie-3-a-new-frontier-for-world-models/) — Google DeepMind blog post by Jack Parker-Holder and Shlomi Fruchter, published 2025-08-05. Read 2026-05-15.
