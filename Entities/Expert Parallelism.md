---
created: 2026-05-12
updated: 2026-05-16
type: entity
refs: 19
tier: active
---

# Expert Parallelism

A parallelism strategy for MoE models where different experts are placed on different GPUs, abbreviated EP.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- [[vLLM]] Wide-EP on [[GB200]] for DeepSeek MoE: reducing EP degree from 4→2 GPUs per prefill instance improved throughput because MLA/MoE compute is already saturated at 64K tokens — halving EP degree halves NCCL all_gather+reduce_scatter overhead; [[NVFP4]] dispatch reduces all-to-all communication volume by 4× vs FP16. — [[2026-02-05-在-blackwell-上推动-vllm-wide-ep-与大规模推理走向成熟-]]
- [[SGLang]]'s DeepEP implementation: all-to-all dispatch (token routing to expert-owning ranks) → local GEMM → all-to-all combine; supports FP8 communication to reduce bandwidth pressure; two modes — Normal (prefill) and Low-Latency (decode) — requiring PD disaggregation to coexist; the 1.25–1.84× single-card kernel gains stack multiplicatively with multi-node EP gains. — [[2026-01-06-142-tflops-的差距-为什么在-blackwell-上-fp4-moe-]]
- EP=32 optimal config for [[DeepSeek-V3]] 671B on 32×H20 (TP=1, PP=1): 8 experts/GPU with uniform distribution across 256 routed experts; TP=1 constraint (vLLM EP mode) prevents all-reduce overhead but prevents KV-Cache sharding. Formula: EP_SIZE = TP_SIZE × DP_SIZE. — [[2025-08-20-ai-fundermentals-inference-solution-deep]]
- Tencent Taiji EP optimization: DeepSeek-V3 256 routed experts with top-8 routing; hot expert activation count 5× higher than cold experts on some layers, causing EP rank compute imbalance. EPLB algorithm + dynamic load balancing + redundant experts reduces imbalance ratio to 1.2–1.5. EP communication timeline cut from 40%+ to ~16% via TRMT library replacing [[DeepEP]]. DP parallel for Decode yields 50%+ single-node throughput gain. — [[2025-08-18-腾讯太极团队实现deepseek模型业内h20最高性能15800-tokens-]]
- 单个 DeepSeek-R1 专家参数量约 44 MB（dim=7168，inter_dim=2048，FP16），在单卡串行加载多专家会严重占满显存带宽；EP 并行通过将专家分散到多机并增大 batch（论文 256，开源 128）提升吞吐，但核心挑战转移到 AlltoAll 跨机通信效率；SGLang 目前在 RoCE 环境用 AG+AR 替代 AlltoAll。 — [[2025-10-09-分析一下ep并行和deepseek开源的deepep代码]]
- 大EP的经济学约束：类比"城市专科医院"，只有病人（并发请求）足够多才能让每位专科医生（expert）满负荷；DeepSeek-V3（256 experts）是当前大EP的工程甜点，但1024 experts时需要4倍以上并发才能维持均衡满负荷，使大EP可扩展性面临用户规模天花板；单用户高token/s只能通过Scale-Up（NVLink域）而非Scale-Out实现。 — [[2025-06-04-https-zhuanlan-zhihu-com-p-1911899575096]]
