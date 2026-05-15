---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 18
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
- Mini3DV 2025 expert consensus identifies world models as the essential pretraining base for embodied VLA models: video-prediction pretraining (VPP, Tsinghua) accumulates physical-world intuition from internet video, enabling robot policy learning with steeper data-scaling curves and less reliance on hardware-specific data — directly addressing VLA's core bottleneck. — [[2025-12-19-mini3dv-2025-观点总结-世界模型前沿进展与技术展望]]
- NVIDIA AVG研究组（Marco Pavone领导）将VLA作为AV基础模型核心研究方向，Alpamayo-R1为首个开源推理VLA；近期工作还包括Latent Chain-of-Thought World Modeling（VLA与潜在世界模型融合用于端到端驾驶）和SafeVL（用VLM精细推理评估驾驶安全性）。 — [[2026-01-13-nvidia-autonomous-vehicle-research-group]]
- Alpamayo-R1's Chain of Causation (CoC) framework enforces three properties absent from prior reasoning VLAs: decision grounding (single explicit closed-set driving decision per trace), causal locality (evidence only from observed history, not future frames), and annotation economy (only decision-relevant factors included); the 16 closed-set decision categories span longitudinal and lateral control axes. — [[2025-12-16-一文读懂英伟达最新开源vla大模型]]
- RynnVLA-002 (Alibaba DAMO Academy) unifies VLA and world model in a single autoregressive LLM: VLA branch generates actions from language+image+state; world-model branch generates next frames from image+action. Modified attention mask prevents actions from attending to prior actions (reduces error accumulation). Continuous Action Transformer resolves poor real-world generalization; LIBERO success rate 97.4% with continuous actions, 80%+ on distractor tasks with SO100 robot arm. Ablation: world-model co-training raises VLA continuous action rate 91.6%→94.6%. — [[2025-12-23-vla-世界模型-又一次漂亮的补位-和一个更深的-陷阱]]
- Motus (Tsinghua/朱军团队) unifies five embodied modeling paradigms (VLA, WM, IDM, VGM, Video+Action joint prediction) via UniDiffuser generative framework + MoT architecture: Qwen3-VL-2B understanding expert, Wan2.2-5B video generation expert, dedicated action Transformer, Tri-model Joint Attention. Optical-flow latent actions bridge internet video and robot control; six-layer data pyramid enables 90% unsupervised + 10% weakly-supervised training. >45 absolute-point improvement over π0.5 on RoboTwin2.0 random-disturbance tasks. — [[2025-12-23-清华大学最新成果-将vla-世界模型和视频模型都统一了]]
- Alibaba Cloud PAI and NVIDIA formally partnered for Physical AI: PAI integrates the full NVIDIA Physical AI stack (Isaac Sim, Isaac Lab, NVIDIA Cosmos, datasets) for world-model and VLA training; customer 卓驭 built a >3 EFLOPS AI platform on Alibaba Cloud for VLA training and end-to-end world model training. — [[2025-12-23-大数据-ai-平台-构筑-agentic-ai-的核心基石]]
- CF-VLA (NVIDIA/UCLA/Stanford) demonstrates counterfactual self-reflection in autonomous driving VLA: meta-actions → counterfactual reasoning → updated meta-actions → trajectory loop improves MinADE/FDE ~9-17.6% and collision rate -20.5% vs. non-reflective baseline; adaptive think rate <0.25 outperforms always-reasoning variant; multi-round training halves the think rate while further improving metrics. Data: 11.6M 20-sec clips + 433K meta-action samples + 200K counterfactual samples from 80K hours across 25 countries. — [[2026-01-07-英伟达alpamayo再进化-反事实推理vla-安全性能提升很可观]]
- DriveLaW (HUST & Xiaomi, arXiv:2512.23421) sets a new SOTA of **89.1 PDMS** on NAVSIM without RL fine-tuning by chaining a Video DiT's intermediate latents (DriveLaW-Video) into a flow-matching diffusion planner (DriveLaW-Act); video generation model features outperform BEV features (+5.0 PDMS) and VLM hidden states (+2.6 PDMS) as planner conditioning; 4.6 FID / 81.3 FVD on nuScenes. — [[2026-01-04-超越drivevla-w0-drivelaw-世界模型表征一统生成与规划-华科-]]
- 地平线DiffusionDrive（HSD一段式端到端）采用anchor-based截断扩散生成轨迹：K-Means出N个常见人类驾驶行为anchor，对anchor加噪更弱，推理时去噪步骤更少；ResAD改进点在于预测惯性残差而非直接生成轨迹，残差正则化使各时刻分布一致，并配备多metric轨迹Ranker。 — [[2025-12-30-摸底地平线hsd一段式端到端的方案设计]]
- 地平线RAD首个基于3DGS构建sensor-level RL环境的端到端驾驶策略：三阶段训练（感知预训练→IL规控→RL+IL混合），从4305个危险场景clip重建3DGS-env；RL+IL混合比4:1时最优，碰撞率比纯IL降低约3倍；3DGS-env局限：仅log replay，无交互，非刚性行人和低光场景渲染差。 — [[2025-12-25-地平线rad-基于3dgs-大规模强化学习的端到端驾驶策略]]
- Li Auto's ICCV'25 training closed-loop stack: VLA Diffusion + world-model RL (RLHF + RLVR + RLAIF); world model provides simulation environment (scene reconstruction, scene editing/transfer/generation); interactive SimAgents identified as the key unsolved challenge for closing the training loop. — [[2025-12-05-理想iccv-25分享了世界模型-从数据闭环到训练闭环]]
- 引望智能（原华为车BU）Percept-WAM以InternVL2-80B为基础，引入World-PV（栅格化PV特征，统一2D检测/分割/单目3D）和World-BEV token（显式建模道路与交通参与者空间关系），开环测试0.36分、仿真90.2分均属中等；缺乏RL和SFT后训练是主要瓶颈。 — [[2025-12-26-3d感知-vla-华为最新wam智能驾驶模型分析]]
- GAIR 2025圆桌专家共识：单打独斗已触及天花板，世界模型联盟势在必行；多位学者将"基于查询的几何基础模型"和"视频Tokenizer突破"列为2026年核心赌注；Genie 3被认为达到GPT-3级别。 — [[2025-12-26-圆桌论坛-关于-世界模型-突破方向的六个猜想-gair-2025]]
