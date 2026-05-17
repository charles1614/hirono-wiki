---
created: 2026-05-15
updated: 2026-05-16
type: topic
source_count: 33
---

# RL Post-Training

## What

Using reinforcement learning to align or refine a pretrained LLM: the policy generates rollouts, a reward model scores them, and a policy-gradient algorithm (PPO, GRPO, GSPO, REINFORCE++) updates the weights. Covers algorithms, infrastructure, and production-scale frameworks.

## Current understanding

The dominant production pattern (as of early 2026) connects a distributed training backend ([[Megatron-LM]] or [[PyTorch]] FSDP) with an inference engine ([[SGLang]] or [[vLLM]]) through an orchestration layer ([[Ray]]). [[slime]] ([[THUDM]]) is the production-proven example: it has been used to train GLM-5, GLM-4.x, Qwen3, DeepSeek V3, and Llama 3 series. Its architecture enforces strict process isolation — training never imports SGLang; inference never imports Megatron — with Ray actors as the bridge and the Ray object store for zero-copy data transfer.

**Algorithm choice** controls the advantage estimator. [[PPO]] requires a critic (value network) for advantage estimation; [[GRPO]] drops the critic and normalizes advantages across a group of samples from the same prompt; [[GSPO]] operates at the sequence level. In slime these are selectable via `--advantage-estimator`. Async training modes introduce controlled off-policy training; mitigations include importance sampling (`--use-tis`) and off-policy sequence masking (`--use-opsm`).

**Resource allocation** is the central tradeoff: colocated mode time-slices training and inference on shared GPUs (fewer GPUs; offloading latency; incompatible with async pipelining), while dedicated mode gives each subsystem its own GPU pool (higher throughput; more GPUs). Async pipelining (overlapping next rollout generation with current training) requires dedicated mode and explicit synchronization barriers before weight updates.

**Fault tolerance** at production scale requires health monitoring of inference engines and automatic replacement of failed instances without stopping the training run — slime implements this via periodic `/health_generate` checks. Long-running RL campaigns on large clusters depend on this more than pretraining does because the generate→train→update cycle creates additional failure surfaces (inference engine OOM, reward model timeout, etc.).

## Open threads

## Sources drawn on

- [[2026-03-22-训练rollout彻底解耦-小红书]] — ProRL Agent (arXiv:2603.18815): Rollout-as-a-Service architecture decoupling multi-turn agent execution from training; 3-layer design with async server + HTTP boundary + rootless HPC support.
- [[2026-03-30-how-kimi-cursor-and-chroma-train-agentic]] — Kimi K2.5 PARL, Cursor Composer 2 real-time RL, and Chroma Context-1 CISPO: three distinct agentic RL systems converging on production-harness training + outcome rewards + large-scale async rollouts.
- [[2026-03-29-周末到-看看最近的论文和技术博客-充充电-小红书]] — Reading list citing Kimi's Attention Residuals paper and Google's "Towards a Science of Scaling Agent Systems" (5 architectures × 4 benchmarks).
- [[2026-01-10-姚顺雨对着唐杰杨植麟林俊旸贴大脸开讲-基模四杰中关村论英雄]] — AGI-Next summit: practitioner confirmation of RLVR verifiable-domain exhaustion; full-async RL with SFT interleaving to prevent local optima; AutoGLM 9B as first open-source Agent-RL model.
- [[2026-01-07-英伟达alpamayo再进化-反事实推理vla-安全性能提升很可观]] — CF-VLA rollout-filter-label self-improving loop: multi-round counterfactual RL training; adaptive reasoning reduces think rate 40-45% while maintaining/improving metrics.
- [[2025-07-06-rasbt-llms-from-scratch-implement-a-chat]] — "Build A Reasoning Model (From Scratch)" sequel covers GRPO RLVR, distillation, LLM-as-judge, and inference-time scaling starting from a pretrained model.
- [[2025-12-25-地平线rad-基于3dgs-大规模强化学习的端到端驾驶策略]] — 地平线RAD三阶段训练+3DGS-env RL；PPO+IL混合；辅助任务设计。

## Observations

- Qwen3.5's post-training gains (vs Qwen3) come almost entirely from scaling RL tasks and environments, emphasizing harder + more generalizable RL environments over narrow metric optimization; the result is broad agent capability improvements across BFCL-V4, VITA-Bench, DeepPlanning, Tool-Decathlon, and MCP-Mark. — [[2026-03-04-qwen3-5-blog]]
- EvoDriveVLA uses knowledge distillation with an Oracle teacher that accesses privileged future-frame information as a form of supervised post-training: the Oracle teacher's superior trajectory predictions guide the student VLA, yielding NAVSIM closed-loop PDM score +3.4 points (+4.2%) for a 3B base model and surpassing Qwen2.5-VL 8B. — [[2026-03-13-小鹏刘先明挂名工作-evodrivevla-通过蒸馏进化vla-感知规划不再割裂]]
- Alpamayo-R1 applies GRPO for AV-specific RL alignment with a three-signal reward (reasoning quality via large reasoning model scoring, reasoning-action consistency via rule-based meta-action matching, trajectory quality via L2 + collision + jerk penalties); RL post-training raised reasoning quality LRM score from 3.1 to 4.5 (+45%) and reasoning-action consistency from 0.62 to 0.85 (+37%). — [[2025-12-16-一文读懂英伟达最新开源vla大模型]]
- [[EasyDistill]] 集成 PPO/GRPO（强化学习路线）和 CogPO（认知偏好优化）算法用于知识蒸馏：CogPO 让小模型认知轨迹与自身能力匹配而非强行模仿大模型，解决 DeepSeek-R1 类慢思考模型的蒸馏难题；配套 OmniThought 数据集（200 万条含 RV/CD 标注的思维链）使 [[DistilQwen]]2.5-R1 等模型在资源受限条件下实现高效推理。 — [[2026-01-15-知识蒸馏不再难-阿里开源easydistill及distilqwen模型家族-开]]
- Karpathy identified RLVR (Reinforcement Learning from Verifiable Rewards) as the defining capability driver of 2025: unlocks much longer optimization runs than SFT/RLHF (which are "thin" finetunes), allows test-time compute scaling via reasoning trace length, and caused labs to redirect pretraining compute toward RL runs. [[DeepSeek-R1]] is cited as the canonical example; OpenAI o1 (late 2024) was first, o3 (early 2025) was the inflection point. — [[2025-12-20-2025-llm-year-in-review]]
- Seer ([[Moonshot AI]] + Tsinghua, arXiv:2511.14617) addresses the synchronous RL rollout long-tail problem with three mechanisms: divided rollout (chunk-based KV-cached generation with dynamic load balancing via [[Mooncake]] global KV pool), context-aware length scheduling (per-group length estimation from first-response oracle + LFS/SFS routing), and adaptive grouped speculative sampling (Compressed Suffix Trees shared across group responses for no-draft-model speculation). Vs VeRL: **74–97% throughput gain**, **75–93% tail-latency reduction** on Qwen2-VL-72B and [[Kimi K2]]. — [[2026-01-04-moonshot-seer-长度感知-分段处理-投机采样-97-吞吐提升]]
- 地平线RAD的3DGS-env RL是AV-domain的RL后训练示例：从2000h真实驾驶数据做感知预训练+IL规控，然后选4305个危险场景用3DGS重建sensor-level env做RL；RL与IL混合比4:1最优，碰撞率降低约3倍；表明3DGS质量和危险场景覆盖度是AV-RL效果的关键瓶颈。 — [[2025-12-25-地平线rad-基于3dgs-大规模强化学习的端到端驾驶策略]]
- ROLL Flash (Alibaba) demonstrates 2.72× Agentic (ALFWorld) and 2.24× RLVR throughput gain over synchronous RL training via per-prompt queue scheduling + prompt replication + environment-level async + redundant environments; AsyPPO shows full-scale critic is unnecessary — two mini-critics achieve comparable quality at 20s/step savings; Attention Rhythm credit-assignment boosts AIME25 +5pp and AMC23 +6.3pp vs GRPO baseline. — [[2025-11-10-3a大作-阿里roll团队从基建-算法-机理-推动rl4llm全栈协同优化]]
- [[Meta]]'s [[ScaleRL]] framework (400K GPU-hours on GB200) provides the first systematic RL compute scaling study: performance follows a sigmoid saturation curve parameterized by asymptotic ceiling A and efficiency B; methods with high small-scale performance often have lower A; technical tricks (loss aggregation, curriculum, length penalty, advantage normalization) improve B not A. — [[2025-10-19-meta用40万个gpu小时做了一个实验-只为弄清强化学习scaling-law]]

- [[Nsight Systems]] integration in [[verl]] (via NVIDIA engineer, Jul 2025): Ray-based RL programs require injecting Nsight via RayActor `runtime_env` at construction time (not via standard `nsys <app>` wrapper) because Ray schedules compute processes remotely; verl's single-controller design adds complexity requiring separate tracking of controller and worker processes; NVTX marks verl's step/gen/reward/update subtasks for per-subtask profiling. — [[2025-07-23-https-zhuanlan-zhihu-com-p-1929264741248]]
- [[vLLM]] V1 RLHF场景权重更新：Actor完整权重（去切片）构建为 `(权重名, tensor)` 迭代器，直接传入 `model_runner.model.load_weights()`，每个TP rank自行切取所需分片；`_initialize_model` 阶段建立HF类名→vLLM Python class映射（惰性注册），量化模型动态替换 `Linear` 为 `QuantLinear`。 — [[2025-05-27-图解vllm-v1系列4-加载模型权重-load_model]]
- NVIDIA profiling-driven recipe for [[verl]]+GRPO RL pipeline (NVIDIA salon, Sep 2025): complete step = Rollout(205.7s) + old_log_prob(85.2s) + reference(80.6s) + actor_update(126.1s) = 501s total; Rollout is bottleneck at 41%; three main optimization levers: (1) sequence packing + dynamic batching → MFU 30.3% → 45.96%; (2) CUDA Graph for rollout → 17% speedup (vLLM backend); (3) async DAPO for long-tail → 20–40% throughput gain. Qwen3 235B MoE SOTA: 256 GPUs, TP=2, PP=8, EP=32, VP=4. — [[2025-09-04-nvidia技术沙龙-强化学习流水线优化-性能分析与-rollout加速-演讲笔]]
- [[Seed-Coder]] Reasoning模型从Base模型（非Instruct）出发进行LongCoT预热+GRPO强化学习，避免SFT模式锁死影响RL探索；分阶段渐进式：16K序列/16样本90步→32K序列/32样本160步；Curriculum Learning过滤正确率>87.5%简单问题，移除KL损失项，剪裁比率0.28。 — [[2025-05-27-seed-coder-feishu-docs]]
- [[AReaL]] async RL eliminates synchronous RL's two inefficiencies (within-rollout long-tail bubble and rollout-trainer serialization) by interrupting mid-sequence generation on weight updates and generating continued responses from prefill; decouple PPO maintains a stable trust region despite multi-checkpoint sequence composition. — [[2025-06-11-异步rl框架areal速览]]
- Awesome-ML-SYS-Tutorial documents that RL "strengthens proficiency (熟练度), not intelligence" — RL can only reinforce outputs the base model has already produced at least once; its value is raising success rate from 10% to 90% on a task, not unlocking new capabilities. — [[2025-07-03-github-zhaochenyang20-awesome-ml-sys-tut]]
- Composer 2 (Cursor) finds both average reward and best-of-K performance improve together during RL training, contradicting the hypothesis that RL merely reweights a fixed pool of paths; key RL modifications: remove length standardization from GRPO, skip advantage std normalization within groups, switch KL estimator from k3 to k1 for variance stability; self-summarization chains multi-generation rollouts with shared rewards to enable long-horizon coherence. — [[2026-03-26-composer]]
- MegaFlow (Alibaba, under review): large-scale agent RL training requires dedicated orchestration infrastructure separate from model compute; many-small-instances (8-core/16 GB/1 task per instance, up to 10,000) outperforms few-large-instances (208-core/3 TB/50 concurrent tasks) in cost (32% reduction), latency consistency (~100 min stable vs. degrading 100→110 min), and max concurrency; validated on 2 million+ production records. — [[2025-10-15-megaflow-large-scale-distributed-orchest]]
