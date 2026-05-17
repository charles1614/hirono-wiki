---
created: 2026-05-11
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 28
tier: active
---

# Qwen

Alibaba's open-weight LLM family; widely used as cost-efficient frontier-adjacent alternative.

## Synthesis





Qwen is Alibaba's LLM family spanning dense and MoE models from 0.6B to 480B+ parameters, with Qwen3 dense models adopting GQA, QK-Norm, RoPE, and SwiGLU, and Qwen3-235B-A22B structurally near-identical to DeepSeek V3 except it drops the shared expert — a deliberate choice after developers found no significant gain from shared experts in 8+ routed-expert configurations. Qwen3-Next (80B-A3B) introduced a Gated DeltaNet + Gated Attention hybrid (3:1 ratio) plus MTP and a restored shared expert, and Qwen3.5-397B-A17B extends that line to 8.6×–19× higher decoding throughput than Qwen3-Max while matching base performance, with a 250k vocabulary across 201 languages and a native FP8 pretraining pipeline yielding ~50% activation memory reduction and >10% throughput gain. A load-bearing deployment pitfall for Qwen3-235B-A22B FP8 is that MoE intermediate_size 1536 / TP8 = 192 is not divisible by the 128-element block-wise quantization granularity, forcing TP4 (1536/4=384) and yielding ~1.75× FP8+TP4 throughput over BF16+TP8. RTPurbo validated 5× attention compute compression on Qwen3-480B by retaining ~15% long-range heads and truncating the rest, with hours-scale self-distillation on ~10K samples recovering long-text performance. The GTE-Qwen embedding line fine-tunes Qwen LLM base weights into a dual-tower retriever via bidirectional attention (`is_causal=False`), an improved 4-term InfoNCE denominator, and last-token pooling, with gte-Qwen2-7B-instruct formerly topping the MTEB leaderboard.





## Observations

- (auto-populated as Sources cite this entity)
- Qwen3-32B 参数量逐层推导：hidden_size=5120，64 layers，GQA（num_attention_heads=64，num_key_value_heads=8，head_dim=128），intermediate_size=25600，vocab_size=151936；每层 Attention 约 94M，MLP 约 393M；总参数量约 32.76B；与 Qwen2.5-32B（无 head_dim 字段，需从 hidden_size/num_attention_heads 推导）参数量相当，尽管 Qwen3 词表更小、intermediate_size 更小。 — [[2025-09-03-https-zhuanlan-zhihu-com-p-1901923837408]]
- Qwen 2.5 0.5B Instruct used as the model under test in a vibe coding interview challenge for attention-based hallucination detection; the 10% max-system-attention threshold was sufficient for demo-scale grounding detection. — [[2025-08-19-又一道-vibe-coding-面试题-基于注意力的-llm-幻觉检测器]]
- Qwen2.5-1.5B used as the reference model in a [[PyTorch]] GPU memory profiling tutorial: 1.5B parameters at float32 → 6 GB model memory; 5,065,216 activations per input token measured via forward hooks. — [[2025-09-22-visualize-and-understand-gpu-memory-in-p]]
- Qwen3 dense models (0.6B–32B) use GQA, QK-Norm, RoPE, and SwiGLU; Qwen3 MoE (235B-A22B) is structurally near-identical to DeepSeek V3 but drops the shared expert — developer confirmed no significant improvement found with 8+ routed experts, and shared expert added inference optimization complexity. — [[2026-01-28-the-big-llm-architecture-comparison]]
- Qwen3-Next (80B-A3B, Sep 2025) adds three co-present efficiency mechanisms: Gated DeltaNet + Gated Attention hybrid (3:1 ratio), MTP for training + speculative decoding at inference, and 4× more experts plus a restored shared expert. Qwen3-Coder-Next (same architecture, Feb 2026) reaches near-Claude-Sonnet 4.5 SWE-Bench Pro performance on coding tasks. — [[2026-01-28-the-big-llm-architecture-comparison]]
- Qwen3.5-397B-A17B (Feb 2026) uses a Gated DeltaNet + Gated Attention hybrid MoE with 397B total / 17B active parameters, achieving 8.6×–19× higher decoding throughput than Qwen3-Max while matching its base performance; 250k vocabulary (up from 150k), 201 languages (up from 119). — [[2026-03-04-qwen3-5-blog]]
- Qwen3.5 pretraining uses a native FP8 pipeline across activations, MoE routing, and GEMM with runtime BF16 fallback in sensitive layers — ~50% activation memory reduction, >10% throughput gain. The asynchronous disaggregated RL training framework achieves 3×–5× end-to-end RL speedup at million-scale agent scaffolds. — [[2026-03-04-qwen3-5-blog]]
- RTPurbo（[[RTP-LLM]]团队）已在Qwen3-480B上验证5倍Attention计算压缩，识别约15%长程头保留全局注意力，其余截断；自蒸馏微调仅需小时级+约1万条数据，长文本表现与原模型持平。 — [[2026-01-14-直播预告-rtpurbo-小时级训练实现qwen3-480b模型5x-atten]]
- Qwen研究主页（2026年4月–5月）快照：Qwen-Scope可解释性工具包（基于SAE，插入Qwen3/Qwen3.5隐藏层）；FlashQLA（GDN架构的CP-/Bwd-Friendly融合线性注意力核，覆盖Qwen3.5/Qwen3.6系列）；Qwen3.6-27B开源dense多模态模型（flagship-level Agentic Coding）；Qwen3.6-Max-Preview专有模型预览版（知识+指令+Coding全面提升）。 — [[2026-01-14-qwen-research]]
- Alibaba Cloud paiMoE engine used Qwen3 full training (CPT/SFT) as the primary production benchmark: Tangram + ChunkFlow as default mechanisms achieved 3× end-to-end speedup and training MFU >61% for Qwen series. Qwen3-VL-2B is also used as the understanding expert in Tsinghua Motus's MoT architecture for embodied robot control. — [[2025-12-23-大数据-ai-平台-构筑-agentic-ai-的核心基石]]
- Qwen2.5-VL-72B-Instruct used as the teacher model in CF-VLA (NVIDIA/UCLA/Stanford) to label counterfactual reasoning traces for autonomous driving VLA training; demonstrates Qwen multimodal models as practical annotation engines in data pipelines for embodied AI. — [[2026-01-07-英伟达alpamayo再进化-反事实推理vla-安全性能提升很可观]]
- Datawhale/Raschka survey (Jul 2025): Qwen3 dense models (0.6B–32B) use deeper architecture (more Transformer blocks, fewer attention heads) than Llama 3 — smaller VRAM footprint but slower generation speed. Qwen3 MoE 235B-A22B near-identical to DeepSeek V3 but drops the shared expert. QK-Norm adopted for training stability. — [[2025-07-25-从deepseek-v3到kimi-k2-八种现代-llm-架构大比较]]
- Qwen3-235B-A22B FP8 model uses e4m3 format with dynamic activation quantization + [128,128] block-wise static weight quantization; MoE intermediate_size=768 per expert means intermediate gate+up combined size 1536 — requires TP divisibility constraint: TP8 fails (1536/8=192 not divisible by 128-block), TP4 works (1536/4=384). — [[2025-05-26-基于vllm-v1测试bfloat16-vs-fp8-qwen3-moe模型吞吐]]
- [[GTE-Qwen]] 从[[Qwen]] LLM Base微调为嵌入模型（gte-Qwen1.5/gte-Qwen2），三核心机制：推理时设 `is_causal=False` 启用双向注意力、额外Instruction Tuning、改进InfoNCE损失（4项分母，τ=0.01）；token表示取序列最后一个真实token；gte-Qwen2-7B-instruct曾登顶MTEB leaderboard第一。 — [[2025-05-27-gte-qwen系列-feishu-docs]]
