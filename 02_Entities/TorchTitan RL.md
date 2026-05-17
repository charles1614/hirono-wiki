---
created: 2026-05-17
updated: 2026-05-17
type: entity
refs: 5
tier: active
---

# TorchTitan RL

TorchTitan's reinforcement learning training setup using a single unified model definition for trainer + generator, enabling shared compiled artifacts

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- TorchTitan RL uses a single unified model definition for both training and inference, unlike Verl / [[OpenRLHF]] which maintain separate trainer/generator definitions. This enables sharing compiled artifacts across trainer and generator: enabling [[Torch Compile]] across the full RL training loop yielded a **6× end-to-end speedup** on Qwen3 0.6B / GSM8K (446s → 70s). — [[2026-05-12-pytorch-devlog]]
