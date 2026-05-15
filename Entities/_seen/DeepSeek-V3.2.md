---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# DeepSeek-V3.2

DeepSeek's 671B MoE LLM (37B active), introduces DSA sparse attention

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- **架构与DSA引入**：671B总参，37B激活；MLA (DSA) + MoE；在V3.1-Terminus基础上引入DeepSeek Sparse Attention。V3.2-Exp于2025-09发布，正式版2025-12-01，扩展思考变体V3.2-Speciale宣称超越GPT-5；支持128K上下文。 — [[2026-03-21-2026大模型架构概览-二-glm-5-dsv3-2]]
- **DSA机制**：Lightning Indexer复用MLA的压缩隐向量，对每个Q打分并排序；Top-k Selector选top-k=2048个token的KV参与注意力计算，使Decode阶段注意力计算量与context长度解耦（O(L²) → O(Lk=2048，即O(1)相对L）。MLA参数配置与GLM 5完全相同（`q_lora_rank=2048, kv_lora_rank=512, qk_nope_head_dim=192, qk_rope_head_dim=64, v_head_dim=256, heads=64`）。 — [[2026-03-21-2026大模型架构概览-二-glm-5-dsv3-2]]
- **发布版本线**（Raschka深度解析）：V3.2-Exp（Sep 2025）加DSA；V3.2（Dec 2025）加自验证/自精炼（来自DeepSeekMath V2）+GRPO稳定性更新（domain-specific KL, unbiased KL, off-policy masking, MoE routing replay）；V3.2是混合指令/推理模型，V3.2-Speciale是扩展思考变体。DeepSeek V3.2回到NVIDIA芯片（据称此前V3.1曾在华为芯片上实验）。 — [[2025-12-04-a-technical-tour-of-the-deepseek-models-]]
