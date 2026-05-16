---
created: 2026-05-12
updated: 2026-05-16
type: entity
refs: 25
tier: active
---

# Kimi K2

Moonshot AI's 1T-parameter open-weights MoE model, the first 1T open-weights model, with K2.5 and K2.6 successors.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Kimi K2 (1T total, 32B active) is structurally a scaled-up DeepSeek V3 — same MLA + sparse MoE blueprint but more experts and fewer MLA heads. As of Raschka's survey, it was the largest open-weight model. It is also the first production model to use the Muon optimizer (over AdamW) at this scale, with exceptionally smooth training loss decay. Kimi K2 Thinking (Nov 2025 update) extends context from 128k to 256k with no architecture change. — [[2026-01-28-the-big-llm-architecture-comparison]]
- Kimi Linear (48B, Oct 2025) is a Kimi-team linear-attention hybrid combining Kimi Delta Attention (channel-wise gated DeltaNet variant) with MLA-based full-attention layers in a 3:1 linear:full ratio. Uses NoPE in the MLA layers to avoid RoPE retuning for long-context scaling. At 48B, shows favorable accuracy vs speed tradeoffs vs GatedDeltaNet-H1. — [[2026-01-28-the-big-llm-architecture-comparison]]
- [[Attention Residual]] (Block AttnRes) is a core architectural innovation in Kimi K2, designed from the start for near-zero inference overhead. The block_num=8 / S=16 layers/block hyperparameter was jointly determined by training efficiency, algorithm quality, and inference latency constraints; the Moonshot AI Infra team confirmed that even Full AttnRes is technically viable at inference time (< 2 GB/card memory at 128K context with TP sharding) but training-side cross-PP communication was the blocker that pushed the Block design. — [[2026-03-21-https-zhuanlan-zhihu-com-p-2017528295286]]
- Kimi K2.6 API pricing (as of 2026-03): uncached input 6.5 RMB/1M tokens, cached input 1.1 RMB/1M, output 27 RMB/1M, 256K context; coding plan enforces a rolling 5-hour and weekly token budget (uncached input + output only). — [[2026-03-20-ai-coding-plan-杰哥的知识库]]
- Kimi K2.5 became the first model on Cloudflare Workers AI's frontier tier (256k context, tool calling, vision); Cloudflare's internal use cut inference costs 77% vs a mid-tier proprietary model for a 7B-token/day security-review agent. — [[2026-03-24-powering-the-agents-workers-ai-now-runs-]]
- Listed on Novita AI's inference API at $0.95/M input and $4.00/M output tokens (Kimi K2.6 variant, OpenAI-compatible API), 58.6% SWE-Bench Pro, 256K context; positioned for long-horizon agentic coding workloads. — [[2026-02-10-novita]]
- AGI-Next summit (Jan 2026): [[Moonshot AI]] founder 杨植麟 framed the Kimi lineage as grounded in a "world-view" philosophy; Kimi's focus on long-context and reasoning reflects a deliberate architectural stance, not a benchmark-chasing strategy. — [[2026-01-10-姚顺雨对着唐杰杨植麟林俊旸贴大脸开讲-基模四杰中关村论英雄]]
- Kimi K2 (DP32/EP32 configuration) is one of the three production models on which Seer's RL rollout system was evaluated, demonstrating that the divided-rollout + context-aware scheduling + grouped speculative sampling approach scales to 1T-parameter MoE models at high parallelism. — [[2026-01-04-moonshot-seer-长度感知-分段处理-投机采样-97-吞吐提升]]
- MoonshotAI's K2 Vendor Verifier (K2VV) found significant vendor quality variance: official MoonshotAI API achieves 100% schema_accuracy; vLLM 87.22% (kimi-k2-thinking) / 76% (kimi-k2-0905), SGLang 95.52% / 73.13%; Groq trigger rate 69.52% (below threshold) and Nebius only 50.60%. Three vendor fixes: use correct vLLM/SGLang versions, rename tool call IDs to `functions.func_name:idx`, add guided encoding. — [[2025-10-12-moonshotai-k2-vendor-verifier-verify-pre]]
- Datawhale/Raschka survey (Jul 2025): Kimi K2 uses Muon optimizer, more experts than DeepSeek V3, fewer MLA heads; training loss curve smooth and rapidly descending. Compared directly to DeepSeek V3 (671B, 37B active) vs Kimi K2 side-by-side architectural diagram in the survey. — [[2025-07-25-从deepseek-v3到kimi-k2-八种现代-llm-架构大比较]]
- Moonshot AI inference engineer detailed K2's four structural differences from [[DeepSeek-V3]]: 384 experts (vs 256), 64 attention heads (vs 128), only 1 dense layer (vs 3), and no expert grouping (n_group=1); head reduction saves ~5 GB/rank in QKVO projections, more than offsetting the ~2.5 GB/rank extra MoE cost at EP=128, keeping decode cost below DSv3 despite 1.5× total parameters. — [[2025-07-15-https-www-zhihu-com-question-19271405065]]
- In the KCORES ball-bouncing heptagon coding benchmark, kimi-k1.5-long-thinking scored 66/90, failing on friction (0), gravity correctness (0), number rotation (0), and heptagon rotation speed (−2); significantly below the top scorers (GPT-4.5-Preview 90, Claude-3.7-Sonnet 88). — [[2025-07-10-kcores-llm-arena-benchmark-ball-bouncing]]
- Kimi K2.6 is listed in Unsloth's tutorial index as a dedicated fine-tuning guide, indicating open-source ecosystem adoption by mid-2025. — [[2025-07-09-tutorials-how-to-fine-tune-run-llms-unsl]]
- Su Jianlin's first-person account of AttnRes design process: Kimi abandoned standard residuals entirely in favor of [[Attention Residual]] inter-layer attention; the abandonment is framed as a more radical departure than HC (Hyper-Connections) or mHC — HC expands residual flow, AttnRes replaces it with learned attention weights across all previous layers. — [[2026-03-22-kimi弃用残差连接背后-苏剑林第一视角解析attention-residual]]
