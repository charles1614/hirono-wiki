---
created: 2026-05-15
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 9
tier: active
---

# NVIDIA Alpamayo

reasoning-based vision language action model for autonomous driving

## Synthesis



NVIDIA Alpamayo is the company's open-source reasoning Vision-Language-Action model line for autonomous driving — the world's first open reasoning-based VLA, with Alpamayo 1 as a 10B-parameter model and Alpamayo-R1 designed as a research-platform release including the AlpaSim modular lightweight perception simulator and the PhysicalAI-AV open dataset (HuggingFace). At GTC 2026 Alpamayo 1.5 demonstrated natural-language instruction following (turn left/right, stop, avoid preceding vehicle, identify nearby buildings), navigation-informed path decisions, and verbal commands, with NVIDIA targeting consumer L4 deployment in 2028 and scale testing in 2027; Alpamayo will ship in mass production on Mercedes CLA and additional vehicle platforms, marking NVIDIA's first volume AV deployment. Alpamayo-R1 supports three visual encoding strategies — single-image tokenizer (default), Triplane multi-camera (~4× compression, fixed token count independent of camera/resolution), and Flex video (~20× compression while maintaining or improving driving performance) — enabling flexible deployment from offline analysis to 99 ms real-time inference on RTX 6000 Pro. Benchmark gains versus baselines: open-loop minADE6@6s improved 12%, closed-loop off-road rate reduced 35% (17% → 11%), close-encounter rate reduced 25% (4% → 3%), and RL post-training raised reasoning-quality LRM score 45% (3.1 → 4.5) with reasoning-action consistency 37% (0.62 → 0.85). The Chain of Causation framework enforces three properties absent from prior reasoning VLAs — decision grounding (single explicit closed-set driving decision per trace), causal locality (evidence only from observed history not future frames), and annotation economy — across 16 closed-set decision categories spanning longitudinal and lateral control.



## Observations

- At GTC 2026 Alpamayo 1.5 was demonstrated supporting natural-language instruction following (turn left/right, stop, avoid preceding vehicle, identify nearby buildings), navigation-informed path decisions, and verbal commands; NVIDIA targets consumer L4 deployment in 2028 with scale testing in 2027. — [[2026-03-22-vla-还是世界模型-gtc-2026-把分歧摆上台面]]
- Alpamayo will ship in mass production on Mercedes CLA and multiple other vehicle platforms, marking NVIDIA's first volume AV deployment. — [[2026-03-22-vla-还是世界模型-gtc-2026-把分歧摆上台面]]
- Alpamayo 系列（2026 年 1 月 CES 发布）包含 Alpamayo 1（10B 参数开源 VLA 推理模型）、物理 AI 开放数据集及 AlpaSim 闭环仿真框架；AlpaSim 已通过 Sim2Val 框架验证仿真结果足以提升实车验证有效性，并支持 RoaD 算法的闭环训练。 — [[2026-01-15-ces-2026-基于-nvidia-alpamayo-构建具备推理能力的辅助驾]]
- Alpamayo-R1 uses three visual encoding strategies: single-image tokenizer (default), Triplane multi-camera tokenizer (~4× compression, fixed token count independent of camera/resolution), and Flex video tokenizer (~20× compression while maintaining or improving driving performance) — enabling flexible deployment from offline analysis to real-time inference. — [[2025-12-16-一文读懂英伟达最新开源vla大模型]]
- Alpamayo-R1 benchmark results vs baselines: open-loop minADE6@6s improved 12%, closed-loop off-road rate reduced 35% (17%→11%), close-encounter rate reduced 25% (4%→3%), RL post-training raised reasoning quality LRM score 45% (3.1→4.5) and reasoning-action consistency 37% (0.62→0.85); end-to-end inference latency on RTX 6000 Pro: 99 ms. — [[2025-12-16-一文读懂英伟达最新开源vla大模型]]
- NVIDIA AVG研究组主页将Alpamayo-R1定位为世界首个面向自动驾驶研究的开源推理VLA模型，配套AlpaSim（模块化轻量感知仿真器）和PhysicalAI-AV数据集（HuggingFace开源），构成数据+模型+闭环评估完整生态；研究组由Marco Pavone领导，聚焦AV感知/预测/规划/控制全栈及AI安全。 — [[2026-01-13-nvidia-autonomous-vehicle-research-group]]
- CF-VLA (NVIDIA/UCLA/Stanford, arXiv:2512.24426) extends Alpamayo-R1's design with a counterfactual self-reflection loop: time-segmented meta-actions (3 axes × 6.4s horizon) serve as action-language alignment tokens; a rollout-filter-label pipeline mines hard cases from baseline rollouts; [[Qwen]] 2.5-VL-72B-Instruct labels counterfactual reasoning traces. Results vs. non-reflective baseline: trajectory error -17.6%, collision rate -20.5%, adaptive think rate <0.25 (first round, with route). — [[2026-01-07-英伟达alpamayo再进化-反事实推理vla-安全性能提升很可观]]
