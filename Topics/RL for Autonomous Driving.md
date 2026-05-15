---
created: 2026-05-15
updated: 2026-05-15
type: topic
source_count: 2
---

# RL for Autonomous Driving

## What

Applying reinforcement learning to train autonomous vehicle planning and sensor simulation systems

## Current understanding

_(stub — populate as sources accumulate. `topic-content-gaps` will lint-warn once source_count ≥ 3.)_

## Open threads

## Observations

- Li Auto at ICCV'25 identifies interactive SimAgents as the key unresolved challenge for training-closed-loop autonomous driving; their L4 training loop uses VLA Diffusion + world-model-based RL (RLHF + RLVR + RLAIF), with 3DGS scene reconstruction providing the simulation environment. — [[2025-12-05-理想iccv-25分享了世界模型-从数据闭环到训练闭环]]
- Horizon Robotics researcher argues that real-vehicle evaluation breaks down above ~50 MPI (Mean Planning Interval), requiring simulation; two parallel approaches are viable: a direct critic-network evaluation model trained on observation + action → quality score, and a decoupled simulation stack (UniMM traffic-flow + DriveCamSim sensor generation); RL optimization of end-to-end models is contingent on mature simulation. — [[2025-11-11-在地平线搞自动驾驶的这三年]]

## Sources drawn on

- [[2025-12-05-理想iccv-25分享了世界模型-从数据闭环到训练闭环]] — Li Auto ICCV'25: training closed-loop stack (VLA+RL+WM), SimAgents, data closed-loop limitations.
- [[2025-11-11-在地平线搞自动驾驶的这三年]] — Horizon Robotics researcher retrospective: Sparse4D/SparseDrive/DriveCamSim/UniMM/LATR as a complete AV R&D stack; argues simulation evaluation is the bottleneck for further RL improvement beyond 50 MPI.
