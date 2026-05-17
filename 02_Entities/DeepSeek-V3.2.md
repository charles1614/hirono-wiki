---
created: 2026-05-15
updated: 2026-05-17
type: entity
refs: 10
tier: active
---

# DeepSeek-V3.2

DeepSeek's 671B MoE LLM (37B active), introduces DSA sparse attention

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- **架构与DSA引入**：671B总参，37B激活；MLA (DSA) + MoE；在V3.1-Terminus基础上引入DeepSeek Sparse Attention。V3.2-Exp于2025-09发布，正式版2025-12-01，扩展思考变体V3.2-Speciale宣称超越GPT-5；支持128K上下文。 — [[2026-03-21-2026大模型架构概览-二-glm-5-dsv3-2]]
- **DSA机制**：Lightning Indexer复用MLA的压缩隐向量，对每个Q打分并排序；Top-k Selector选top-k=2048个token的KV参与注意力计算，使Decode阶段注意力计算量与context长度解耦（O(L²) → O(Lk=2048，即O(1)相对L）。MLA参数配置与GLM 5完全相同（`q_lora_rank=2048, kv_lora_rank=512, qk_nope_head_dim=192, qk_rope_head_dim=64, v_head_dim=256, heads=64`）。 — [[2026-03-21-2026大模型架构概览-二-glm-5-dsv3-2]]
- **发布版本线**（Raschka深度解析）：V3.2-Exp（Sep 2025）加DSA；V3.2（Dec 2025）加自验证/自精炼（来自DeepSeekMath V2）+GRPO稳定性更新（domain-specific KL, unbiased KL, off-policy masking, MoE routing replay）；V3.2是混合指令/推理模型，V3.2-Speciale是扩展思考变体。DeepSeek V3.2回到NVIDIA芯片（据称此前V3.1曾在华为芯片上实验）。 — [[2025-12-04-a-technical-tour-of-the-deepseek-models-]]
- DeepSeek-V3.2 (671B/37B active) is available via multiple Chinese cloud coding plans as of 2026-03, with Volcengine Ark, 阿里云百炼, 百度千帆, 京东云, and others offering it; no vision capability. — [[2026-03-20-ai-coding-plan-杰哥的知识库]]
- [[DeepSeek-V3.2]] 引入 DeepSeek Sparse Attention（DSA）将注意力从 O(N²) 降至 O(N×K)；三模块流水线：Lightning Indexer（FP8 GEMM 快速相似度打分）→ Top-k Selector（O(N) Radix Sort 两阶段，避免全序列排序）→ Sparse MLA（仅对 top-k KV 位置计算完整注意力）；[[TileLang]] 被用于高效实现这些算子。 — [[2025-10-09-从deepseek-v3-2-dsa算子看tilelang编译器的细节]]
- [[DeepSeek-V4]] (2026) reports significant efficiency gains over DeepSeek V3.2 at 1M-token context: V4-Pro uses 27% of single-token inference FLOPs and 10% of KV cache size vs V3.2 (which uses [[MLA]] + DeepSeek Sparse Attention); V4-Flash hits 10% FLOPs and 7% KV cache. V4 replaces V3.2's MLA+DSA attention with a [[Compression Sparse Attention]] / [[Highly Compressed Attention]] hybrid that compresses along the sequence dimension rather than the per-token representation. — [[2026-05-17-recent-developments-in-llm-architectures]]
- [[DeepSeek-V3.2]] is the default LLM in Tencent's [[TencentDB Agent Memory]] Hermes Docker image, accessed via Tencent Cloud LKE endpoint (`api.lkeap.cloud.tencent.com/v1`). — [[2026-05-16-tencent-tencentdb-agent-memory-tencentdb]]
