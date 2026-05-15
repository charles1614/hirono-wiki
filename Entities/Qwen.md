---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 11
tier: active
---

# Qwen

Alibaba's open-weight LLM family; widely used as cost-efficient frontier-adjacent alternative.

## Synthesis

*Regenerated from Observations below.*

## Observations

- (auto-populated as Sources cite this entity)
- Qwen 2.5 0.5B Instruct used as the model under test in a vibe coding interview challenge for attention-based hallucination detection; the 10% max-system-attention threshold was sufficient for demo-scale grounding detection. — [[2025-08-19-又一道-vibe-coding-面试题-基于注意力的-llm-幻觉检测器]]
- Qwen2.5-1.5B used as the reference model in a [[PyTorch]] GPU memory profiling tutorial: 1.5B parameters at float32 → 6 GB model memory; 5,065,216 activations per input token measured via forward hooks. — [[2025-09-22-visualize-and-understand-gpu-memory-in-p]]
- Qwen3 dense models (0.6B–32B) use GQA, QK-Norm, RoPE, and SwiGLU; Qwen3 MoE (235B-A22B) is structurally near-identical to DeepSeek V3 but drops the shared expert — developer confirmed no significant improvement found with 8+ routed experts, and shared expert added inference optimization complexity. — [[2026-01-28-the-big-llm-architecture-comparison]]
- Qwen3-Next (80B-A3B, Sep 2025) adds three co-present efficiency mechanisms: Gated DeltaNet + Gated Attention hybrid (3:1 ratio), MTP for training + speculative decoding at inference, and 4× more experts plus a restored shared expert. Qwen3-Coder-Next (same architecture, Feb 2026) reaches near-Claude-Sonnet 4.5 SWE-Bench Pro performance on coding tasks. — [[2026-01-28-the-big-llm-architecture-comparison]]
- Qwen3.5-397B-A17B (Feb 2026) uses a Gated DeltaNet + Gated Attention hybrid MoE with 397B total / 17B active parameters, achieving 8.6×–19× higher decoding throughput than Qwen3-Max while matching its base performance; 250k vocabulary (up from 150k), 201 languages (up from 119). — [[2026-03-04-qwen3-5-blog]]
- Qwen3.5 pretraining uses a native FP8 pipeline across activations, MoE routing, and GEMM with runtime BF16 fallback in sensitive layers — ~50% activation memory reduction, >10% throughput gain. The asynchronous disaggregated RL training framework achieves 3×–5× end-to-end RL speedup at million-scale agent scaffolds. — [[2026-03-04-qwen3-5-blog]]
- RTPurbo（[[RTP-LLM]]团队）已在Qwen3-480B上验证5倍Attention计算压缩，识别约15%长程头保留全局注意力，其余截断；自蒸馏微调仅需小时级+约1万条数据，长文本表现与原模型持平。 — [[2026-01-14-直播预告-rtpurbo-小时级训练实现qwen3-480b模型5x-atten]]
- Qwen研究主页（2026年4月–5月）快照：Qwen-Scope可解释性工具包（基于SAE，插入Qwen3/Qwen3.5隐藏层）；FlashQLA（GDN架构的CP-/Bwd-Friendly融合线性注意力核，覆盖Qwen3.5/Qwen3.6系列）；Qwen3.6-27B开源dense多模态模型（flagship-level Agentic Coding）；Qwen3.6-Max-Preview专有模型预览版（知识+指令+Coding全面提升）。 — [[2026-01-14-qwen-research]]
