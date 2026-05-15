---
created: 2026-05-15
updated: 2026-05-15
type: topic
source_count: 8
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

## Observations

- Qwen3.5's post-training gains (vs Qwen3) come almost entirely from scaling RL tasks and environments, emphasizing harder + more generalizable RL environments over narrow metric optimization; the result is broad agent capability improvements across BFCL-V4, VITA-Bench, DeepPlanning, Tool-Decathlon, and MCP-Mark. — [[2026-03-04-qwen3-5-blog]]
- EvoDriveVLA uses knowledge distillation with an Oracle teacher that accesses privileged future-frame information as a form of supervised post-training: the Oracle teacher's superior trajectory predictions guide the student VLA, yielding NAVSIM closed-loop PDM score +3.4 points (+4.2%) for a 3B base model and surpassing Qwen2.5-VL 8B. — [[2026-03-13-小鹏刘先明挂名工作-evodrivevla-通过蒸馏进化vla-感知规划不再割裂]]
- [[EasyDistill]] 集成 PPO/GRPO（强化学习路线）和 CogPO（认知偏好优化）算法用于知识蒸馏：CogPO 让小模型认知轨迹与自身能力匹配而非强行模仿大模型，解决 DeepSeek-R1 类慢思考模型的蒸馏难题；配套 OmniThought 数据集（200 万条含 RV/CD 标注的思维链）使 [[DistilQwen]]2.5-R1 等模型在资源受限条件下实现高效推理。 — [[2026-01-15-知识蒸馏不再难-阿里开源easydistill及distilqwen模型家族-开]]
