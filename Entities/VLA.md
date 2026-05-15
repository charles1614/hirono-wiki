---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 5
tier: active
---

# VLA

Vision-Language-Action model architecture used in autonomous driving that grounds decisions in language, extended by Xiaomi into XLA with additional modalities.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- GTC 2026 showed VLA and world-model paths converging: VLA models (理想 MindVLA-o1, NVIDIA Alpamayo) are adding predictive latent world-model heads, while world-model-first approaches (宇树) are under pressure from real-time and engineering constraints. — [[2026-03-22-vla-还是世界模型-gtc-2026-把分歧摆上台面]]
- 理想汽车 MindVLA-o1 adds a 3D ViT encoder (self-supervised next-frame prediction, joint geometry+semantics+motion), a predictive latent world model (future-state inference in latent space), and parallel trajectory decoding with diffusion optimization for smooth action output. — [[2026-03-22-vla-还是世界模型-gtc-2026-把分歧摆上台面]]
- 宇树科技 CEO 王兴兴 argued VLA has a "lower ceiling" vs. world models/video generation at GTC 2026; unresolved generalization remains the central critique. — [[2026-03-22-vla-还是世界模型-gtc-2026-把分歧摆上台面]]
- EvoDriveVLA (PKU + XPeng) addresses visual encoder degradation during SFT via a self-anchored distillation module — a frozen copy of the student encoder before fine-tuning provides token-level anchoring constraints weighted by trajectory relevance. — [[2026-03-13-小鹏刘先明挂名工作-evodrivevla-通过蒸馏进化vla-感知规划不再割裂]]
- EvoDriveVLA's Oracle teacher model gains trajectory accuracy by conditioning on privileged future-second images and ego-state, combined with coarse-to-fine refinement and MC-Dropout sampling to produce diverse soft distillation targets. — [[2026-03-13-小鹏刘先明挂名工作-evodrivevla-通过蒸馏进化vla-感知规划不再割裂]]
- VLA inference design space is large and unconverged (model architecture, deployment location, sync/async tradeoff); VLA-Perf applies roofline analysis to map the combinatorial space of algorithm × hardware × network, deriving 15 performance insights. — [[2026-03-24-nvidia-vla-inference性能系统分析-小红书]]
- Li Auto (理想汽车) MindVLA-o1 at GTC 2026 adds a generative world model as a supervised training signal, a MoE parallel action decoder for efficient inference, RL with world-model rollouts, and hardware-software co-design for production efficiency — framed as addressing "mainstream VLA paradigm limitations." — [[2026-03-17-gtc2026理想汽车詹锟-mindvla-o1分享-小红书]]
- [[NVIDIA Alpamayo]] 1 是 10B 参数开源 VLA 推理模型（Reasoning VLA），在语义空间运行的隐式世界模型，能生成逐步解决复杂问题的推理轨迹，配套 AlpaSim 闭环仿真框架和物理 AI 开放数据集，代表 NVIDIA 对 reasoning-VLA 路径的系统性投入。 — [[2026-01-15-ces-2026-基于-nvidia-alpamayo-构建具备推理能力的辅助驾]]
