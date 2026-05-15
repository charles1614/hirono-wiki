---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# GLM 5

Zhipu AI's 774B MoE LLM (40B active), adopts DSA sparse attention

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- **架构概览**（2026-02发布）：774B总参，40B激活；MLA (DSA) + MoE；前3层Dense，后续MoE层采用独立专家+共享专家、top-8路由；支持200k上下文；采用智谱自研Slime框架训练。相比GLM 4.x最大结构变化是注意力从GQA改为DSA（DeepSeek Sparse Attention）。 — [[2026-03-21-2026大模型架构概览-二-glm-5-dsv3-2]]
- **DSA参数配置**（与DeepSeek V3.2相同）：MLA：`q_lora_rank=2048, kv_lora_rank=512, qk_nope_head_dim=192, qk_rope_head_dim=64, v_head_dim=256, heads=64`；Indexer：`index_topk=2048, index_head_dim=128, index_n_heads=32`。 — [[2026-03-21-2026大模型架构概览-二-glm-5-dsv3-2]]
- **基准表现**：SWE-bench-Verified 77.8，Terminal Bench 2.0 56.2，超越Gemini 3.0 Pro。Raschka的架构调研将GLM-5（744B）并列GPT-5.2、Gemini Pro 3、Claude 4.6 Opus同一性能段。 — [[2026-03-21-2026大模型架构概览-二-glm-5-dsv3-2]], [[2026-01-28-the-big-llm-architecture-comparison]]
