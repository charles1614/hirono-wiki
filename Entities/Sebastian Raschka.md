---
created: 2026-05-12
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 5
tier: active
---

# Sebastian Raschka

ML educator and researcher who maintains the LLM Architecture Gallery, a live-updated visual catalog of LLM architectures.

## Synthesis



Sebastian Raschka maintains the canonical living survey of modern open-weight LLM architectures — The Big LLM Architecture Comparison on Substack (23+ models spanning 2024–2026, updated continuously) and the LLM Architecture Gallery with side-by-side visual diagrams that serve as primary receipts for cross-lab architectural shifts including DeepSeek V4's reported MLA retirement (V4-Pro and V4-Flash rendered with CSA + HCA composition, not MLA). His Dec 2025 deep-dive on the DeepSeek V3→V3.2 lineage characterizes V3.2 as an MoE + MLA + DSA hybrid-reasoning model distinct from the dedicated reasoning model R1, and covers the DeepSeekMath V2 self-verification and self-refinement updates and GRPO stability improvements (domain-specific KL, unbiased KL, off-policy masking, MoE routing replay). The Datawhale-compiled Chinese translation of his July 2025 architecture comparison covers eight models (DeepSeek V3/R1, OLMo 2, Gemma 3, Mistral Small 3.1, Llama 4, Qwen3, SmolLM3, Kimi K2) and frames the seven-year evolution as four axes of differentiation: attention mechanism (MLA vs GQA vs MHA), normalization position (Pre/Post), MoE expert design, and position encoding (RoPE vs NoPE). His Manning book "Build A Large Language Model (From Scratch)" with the `rasbt/LLMs-from-scratch` companion repo provides chapter-by-chapter implementations through DPO instruction finetuning, with bonus material on MoE, MLA, GQA, sliding-window attention, and Llama 3.2 / Qwen3 / Gemma 3-4 / Olmo 3 from-scratch implementations; the sequel covers GRPO RLVR, distillation, and inference-time scaling.



## Observations

- Maintains a living Substack survey (The Big LLM Architecture Comparison) covering 23+ open-weight models from 2024–2026, updated continuously as new models release. Also maintains an LLM Architecture Gallery (sebastianraschka.com/llm-architecture-gallery/) with visual side-by-side architecture diagrams used as primary receipts for the MLA retirement and V4 architectural shift. Also co-advised the LLM efficiency challenge at NeurIPS 2023. — [[2026-01-28-the-big-llm-architecture-comparison]]
- Published a standalone deep-dive on the DeepSeek V3→V3.2 lineage (Dec 2025, last updated Jan 1 2026), covering DSA sparse attention, DeepSeekMath V2 self-verification + self-refinement, and GRPO training updates for V3.2. Characterizes V3.2 as an MoE + MLA + DSA hybrid-reasoning model distinct from the dedicated reasoning model R1. — [[2025-12-04-a-technical-tour-of-the-deepseek-models-]]
- Datawhale 编译的 Raschka 中文横评文章（Jul 2025）对比八种架构：DeepSeek V3/R1、OLMo 2、Gemma 3、Mistral Small 3.1、Llama 4、Qwen3、SmolLM3、Kimi K2；核心发现：七年来 Transformer 基础稳定，真正差异在注意力机制（MLA vs GQA vs MHA）、归一化位置（Pre/Post）、MoE 专家设计和位置编码（RoPE vs NoPE）四个维度。 — [[2025-07-25-从deepseek-v3到kimi-k2-八种现代-llm-架构大比较]]
- "Build A Large Language Model (From Scratch)" (Manning 2024, ISBN 978-1633437166): 7 chapters from GPT implementation to DPO instruction finetuning; companion GitHub repo (`rasbt/LLMs-from-scratch`) includes bonus material on MoE, MLA, GQA, sliding-window attention, and from-scratch implementations of Llama 3.2, Qwen3, Gemma 3/4, Olmo 3; 17h15m companion video course at Manning; sequel "Build A Reasoning Model (From Scratch)" covers GRPO RLVR, distillation, and inference-time scaling. — [[2025-07-06-rasbt-llms-from-scratch-implement-a-chat]]
- Published "From GPT-2 to gpt-oss" (Aug 2025): detailed architecture walkthrough of OpenAI's gpt-oss-20B/120B covering 7 GPT-2→gpt-oss evolution points (dropout removal, RoPE, SwiGLU/MoE, GQA, sliding-window attention, RMSNorm) plus gpt-oss-specific MXFP4 quantization, attention bias+sinks, and controllable reasoning effort; trained 2.1M H100-hours (SFT+RL); Apache 2.0 open-weight. — [[2025-09-03-from-gpt-2-to-gpt-oss-analyzing-the-arch]]
