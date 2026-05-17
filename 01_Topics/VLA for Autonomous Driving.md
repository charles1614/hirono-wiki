---
created: 2026-05-15
updated: 2026-05-16
type: topic
source_count: 16
---

# VLA for Autonomous Driving

## What

vision-language-action models applied to autonomous vehicle perception and planning

## Current understanding

_(stub — populate as sources accumulate. `topic-content-gaps` will lint-warn once source_count ≥ 3.)_

## Open threads

## Observations

- Alpamayo-R1's GRPO reward has three components: reasoning quality (scored by a large reasoning model like [[DeepSeek-R1]]), reasoning-action consistency (rule-based match of CoC decision description vs predicted trajectory meta-action), and trajectory quality (L2 distance to expert + collision penalty + jerk penalty) — the first published multi-signal RL reward for structured causal reasoning in AV driving. — [[2025-12-16-一文读懂英伟达最新开源vla大模型]]
- Mini3DV 2025 identifies a fundamental VLA training bottleneck: robot body diversity and scarce physical interaction data prevent the "scale internet text" paradigm from transferring; world-model video pretraining (VPP) decouples capability acquisition from hardware-specific data, achieving steeper data-scaling curves vs. standard VLA pretraining. — [[2025-12-19-mini3dv-2025-观点总结-世界模型前沿进展与技术展望]]
- DriveLaW (HUST & Xiaomi, arXiv:2512.23421) chains a Video DiT generator with a diffusion-based planner via shared intermediate latents; achieves **89.1 PDMS** on NAVSIM (new SOTA without RL fine-tuning) and 4.6 FID / 81.3 FVD on nuScenes; VGM latents outperform BEV features by +5.0 PDMS and VLM hidden states by +2.6 PDMS as planner conditioning. Scaling driving video pretraining gives +3.2 PDMS, exhibiting a scaling law. — [[2026-01-04-超越drivevla-w0-drivelaw-世界模型表征一统生成与规划-华科-]]
- 地平线HSD一段式端到端：DiffusionDrive用anchor-based截断扩散生成轨迹（K-Means anchor+惯性残差+轨迹Ranker）；ResAD改进：预测惯性残差而非直接生成轨迹，残差正则化使各时刻分布一致；商量轨迹稳定性需求推动Ranker设计。 — [[2025-12-30-摸底地平线hsd一段式端到端的方案设计]]
- 地平线RAD：3DGS sensor-level RL环境+三阶段训练，碰撞率比纯IL降低3倍；3DGS-env局限性（无交互、非刚性场景渲染差）限制了RL探索上限，强调3DGS质量对RL训练有效性的决定性作用。 — [[2025-12-25-地平线rad-基于3dgs-大规模强化学习的端到端驾驶策略]]
- 引望智能Percept-WAM将3D感知token（World-PV/BEV/Action）与VLM基座融合，开环和仿真成绩中等偏上（0.36/90.2）；NAVSIM闭环测试中理想TransDiffuser以94.9分领先；华为方案缺乏RL和SFT后训练是主要短板。 — [[2025-12-26-3d感知-vla-华为最新wam智能驾驶模型分析]]
- Li Auto at ICCV'25: data closed-loop alone (200+ triggers, 15–45s clips, 1-min upload) cannot solve long-tail scenarios; the next phase is a training closed-loop using world-model RL, with MPI now at 220+ (~19× improvement since July 2024). Training closed-loop tech stack: Feedforward 3DGS reconstruction, video/point-cloud generation, SimAgent RL with reward models. — [[2025-12-05-理想iccv-25分享了世界模型-从数据闭环到训练闭环]]
- DGGT（清华+小米，2025-12-08）证明pose-free feed-forward 4D高斯重建可作为"可编辑4D场景资产生成器"：仅Waymo训练实现nuScenes/Argoverse2零样本泛化（LPIPS分别−61.4%/−52.5%）；输入视角4→8→16时性能稳定；lifespan head建模静态区域时间变化（去除后PSNR −3.2 dB）；支持实例级添加/删除/移动操作+扩散精修，可直接用于自动驾驶仿真和数据合成。 — [[2025-12-10-清华-小米最新dggt-0-4秒完成4d自驾高斯重建-性能提升50]]
- The "自动驾驶之心" community taxonomy of 40+ autonomous driving technology tracks (2025-08) confirms RL as a necessary VLA component: community explicitly tracks RL foundations, popular RL algorithms, and VLM-RL integration as part of the VLA subdomain, alongside E2E AD variants (one-stage, two-stage, VLA algorithms, production deployment discussions). — [[2025-08-15-汇总了自动驾驶几乎所有的技术栈]]

## Sources drawn on

- [[2025-12-16-一文读懂英伟达最新开源vla大模型]] — Alpamayo-R1 technical deep-dive: CoC dataset, modular tokenizer, Cosmos-Reason backbone, GRPO training, benchmark results.
- [[2025-12-19-mini3dv-2025-观点总结-世界模型前沿进展与技术展望]] — Mini3DV 2025 consensus on world models as VLA pretraining base and G1–G4 taxonomy.
- [[2026-01-13-nvidia-autonomous-vehicle-research-group]] — NVIDIA AVG主页：Alpamayo-R1首个开源推理VLA，配套AlpaSim仿真器+PhysicalAI-AV数据集；AVG四大方向涵盖下一代AV架构、VLA基础模型、仿真、AI安全。
- [[2026-01-04-超越drivevla-w0-drivelaw-世界模型表征一统生成与规划-华科-]] — DriveLaW chain architecture; 89.1 PDMS NAVSIM SOTA; VGM latent conditioning ablations.
- [[2026-01-07-英伟达alpamayo再进化-反事实推理vla-安全性能提升很可观]] — CF-VLA (NVIDIA/UCLA/Stanford): counterfactual self-reflection loop (meta-actions → CF reasoning → updated meta-actions → trajectory); rollout-filter-label pipeline; Qwen2.5-VL-72B teacher; +17.6% trajectory, -20.5% collision rate; adaptive think rate <0.25.
- [[2025-12-30-摸底地平线hsd一段式端到端的方案设计]] — 地平线DiffusionDrive+ResAD两篇核心论文解析；截断扩散+残差监督+轨迹Ranker设计。
- [[2025-12-25-地平线rad-基于3dgs-大规模强化学习的端到端驾驶策略]] — 地平线RAD三阶段训练+3DGS-env RL；动作空间设计、奖励函数、辅助任务详解。
- [[2025-12-26-3d感知-vla-华为最新wam智能驾驶模型分析]] — 引望Percept-WAM+OpenDriveVLA（慕尼黑工大）对比分析；NAVSIM成绩排行。
- [[2025-12-26-圆桌论坛-关于-世界模型-突破方向的六个猜想-gair-2025]] — GAIR 2025世界模型圆桌：六位学者对2026年技术方向的预测与讨论。
