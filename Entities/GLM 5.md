---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 5
tier: active
---

# GLM 5

Zhipu AI's 774B MoE LLM (40B active), adopts DSA sparse attention

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- **架构概览**（2026-02发布）：774B总参，40B激活；MLA (DSA) + MoE；前3层Dense，后续MoE层采用独立专家+共享专家、top-8路由；支持200k上下文；采用智谱自研Slime框架训练。相比GLM 4.x最大结构变化是注意力从GQA改为DSA（DeepSeek Sparse Attention）。 — [[2026-03-21-2026大模型架构概览-二-glm-5-dsv3-2]]
- **DSA参数配置**（与DeepSeek V3.2相同）：MLA：`q_lora_rank=2048, kv_lora_rank=512, qk_nope_head_dim=192, qk_rope_head_dim=64, v_head_dim=256, heads=64`；Indexer：`index_topk=2048, index_head_dim=128, index_n_heads=32`。 — [[2026-03-21-2026大模型架构概览-二-glm-5-dsv3-2]]
- **基准表现**：SWE-bench-Verified 77.8，Terminal Bench 2.0 56.2，超越Gemini 3.0 Pro。Raschka的架构调研将GLM-5（744B）并列GPT-5.2、Gemini Pro 3、Claude 4.6 Opus同一性能段。 — [[2026-03-21-2026大模型架构概览-二-glm-5-dsv3-2]], [[2026-01-28-the-big-llm-architecture-comparison]]
- GLM-5.1 (744B/40B active) API pricing (as of 2026-03): uncached input 6–8 RMB/1M, cached 1.3–2 RMB/1M, output 24–28 RMB/1M, 200K context; in the 智谱 Coding Plan it is positioned as a Claude Opus equivalent and consumes 2–3× quota vs. GLM-4.7 (off-peak 2×, peak 3×). — [[2026-03-20-ai-coding-plan-杰哥的知识库]]
- Z.AI release notes position GLM-5 as a complex systems engineering model that benchmarks against Claude Opus 4.5 in code-logic density; integrates DeepSeek Sparse Attention for higher token efficiency while preserving long-context quality. — [[2026-03-24-new-released-overview-z-ai-developer-doc]]
- Technical report titled "GLM-5: from Vibe Coding to Agentic Engineering" covers model training full pipeline and training infrastructure; cited as detail-rich reading material for practitioners. — [[2026-03-29-周末到-看看最近的论文和技术博客-充充电-小红书]]
