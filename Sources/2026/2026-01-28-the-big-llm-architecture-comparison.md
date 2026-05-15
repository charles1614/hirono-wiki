---
created: 2026-01-28
updated: 2026-05-15
type: source
source_url: https://magazine.sebastianraschka.com/p/the-big-llm-architecture-comparison
tags: [pretraining, survey]
---

# [2026-01-28] The Big LLM Architecture Comparison

> 原文链接: https://magazine.sebastianraschka.com/p/the-big-llm-architecture-comparison
> 作者: Sebastian Raschka, PhD — last updated Apr 2, 2026 (added Gemma 4 §23)

---

## TL;DR

[[Sebastian Raschka]]'s living survey of 2024–2026 open-weight LLM architectures (23+ sections, continuously updated). The central finding is that the core transformer structure has barely changed since GPT-2 — rotational embeddings ([[RoPE]]), [[GQA]], and SwiGLU are the main structural diffs — but the key 2025 innovation is [[MoE]] going mainstream across nearly every flagship model. The survey traces how [[MLA]] (DeepSeek's KV-compression scheme) spread to [[Kimi K2]] and [[GLM-4.5]], while [[GQA]] remained the baseline for [[Llama]], [[Gemma]], [[Qwen]], and [[Mistral Small]]. By late 2025 / early 2026, a second wave of architectural differentiation emerged: linear attention hybrids (Gated DeltaNet, Mamba-2), sliding window attention, NoPE, QK-Norm, and multi-token prediction began appearing in models like [[Qwen]] (Qwen3-Next), [[MiniMax M2]], NVIDIA Nemotron 3, and [[Kimi K2]] (Kimi Linear).

## Key claims

1. **MoE is now the dominant paradigm for large frontier models.** [[DeepSeek-R1]] / V3 (671B, 37B active), [[Llama 4 Maverick]] (400B, 17B active), [[Qwen]] 3 235B-A22B, [[GPT-OSS]] (MoE variant), [[GLM-4.5]] (355B), [[Kimi K2]] (1T), and Mistral 3 Large (675B) all use MoE. The shared-expert pattern (always-active expert alongside routed experts) is used by DeepSeek V3, [[GLM-4.5]], Grok 2.5, and Qwen3-Next, but notably dropped in [[Qwen]] 3 (dense MoE). — [[2026-01-28-the-big-llm-architecture-comparison]]

2. **[[MLA]] vs [[GQA]]: two competing KV-compression strategies.** [[MLA]] (DeepSeek V3, [[Kimi K2]], [[GLM-4.5]], Kimi Linear) compresses KV into a low-dimensional latent at the cost of extra matmuls. [[GQA]] (Llama 3, Gemma 3, Qwen3, [[Mistral Small]] 3.1, [[GPT-OSS]], MiniMax M2) shares K/V heads across query groups — simpler, well-supported by FlashAttention. DeepSeek-V2 ablations show [[MLA]] outperforms standard MHA in modeling quality while [[GQA]] slightly underperforms MHA. — [[2026-01-28-the-big-llm-architecture-comparison]]

3. **Sliding window attention is the main inference-efficiency trick for dense models.** Gemma 3 uses a 5:1 local:global ratio with 1024-token window (down from Gemma 2's 4096); Gemma 4 and Xiaomi MiMo adopt the same 5:1 ratio. [[GPT-OSS]] uses sliding window in every other layer. Olmo 3 (7B) and Arcee Trinity use a 3:1 ratio. Earlier [[Mistral Small]] 3.1 dropped sliding window entirely to enable standard FlashAttention optimization. — [[2026-01-28-the-big-llm-architecture-comparison]]

4. **Normalization placement is non-trivial and diverges across architectures.** OLMo 2/3 adopts Post-Norm (RMSNorm after, not before, attention + FFN) for training stability. Gemma 3/4 applies both Pre- and Post-Norm around the attention block. Qwen3 and others use QK-Norm (RMSNorm on Q and K inside attention before RoPE), first demonstrated in scaling Vision Transformers (2023). — [[2026-01-28-the-big-llm-architecture-comparison]]

5. **Linear attention hybrids are rising in late-2025 models, with mixed production results.** Qwen3-Next and Kimi Linear combine Gated DeltaNet blocks (O(n) complexity) with full-attention layers in a 3:1 ratio. NVIDIA Nemotron 3 Nano uses a Mamba-2 + MoE hybrid. MiniMax reverted from lightning attention (M1) to full attention in M2, citing poor accuracy on reasoning and multi-turn tasks — signaling that linear attention requires careful architectural integration. — [[2026-01-28-the-big-llm-architecture-comparison]]

6. **Multi-Token Prediction (MTP) has become a mainstream training (and sometimes inference) technique.** DeepSeek V3/V3.2, GLM-4.5, Qwen3-Next, Nemotron 3 Super, and Xiaomi MiMo all use MTP. Nemotron 3 Super goes further: the shared-weight MTP head acts as a native speculative-decoding draft model at inference time, avoiding a separate external draft model. — [[2026-01-28-the-big-llm-architecture-comparison]]

7. **Architecture convergence: Kimi K2 and Mistral 3 both adopted the DeepSeek V3 blueprint.** Kimi K2 (1T) scales up DeepSeek V3's MoE + MLA with more experts and fewer MLA heads. Mistral 3 Large (675B) uses identical DeepSeek V3 structure but with fewer, larger experts. This cross-lab adoption is Raschka's evidence that DeepSeek V3 is the 2025 reference architecture for large MoE models. — [[2026-01-28-the-big-llm-architecture-comparison]]

8. **NoPE (No Positional Embedding) layers provide better length generalization.** SmolLM3 applies NoPE in every 4th layer; Arcee Trinity uses NoPE in global attention layers; Kimi Linear uses NoPE in MLA layers to enable pure multi-query attention at inference without RoPE retuning for long-context scaling. Trade-off: causal attention mask preserves token ordering implicitly without explicit positional signal. — [[2026-01-28-the-big-llm-architecture-comparison]]

## Visual observations

**Fig 1 — Architecture overview mosaic** (decorative, model-family grid; no load-bearing claims beyond what's in the text)

**Fig 2 — MHA vs GQA** (load-bearing schematic)

![GQA groups 2 query heads per shared K/V pair; comparison to MHA where each head has its own K/V](../../raw/raindrop/magazine.sebastianraschka.com/2026-01-28-the-big-llm-architecture-comparison/substack-img-003.png)

Core reference diagram explaining GQA's group-sharing mechanism; GQA reduces K/V parameter count and KV-cache bandwidth, at modest quality cost relative to MHA.

**Fig 3 — MLA vs MHA** (load-bearing schematic)

![MLA compresses K/V into a low-dimensional latent before storing in the KV cache; MHA stores full K/V](../../raw/raindrop/magazine.sebastianraschka.com/2026-01-28-the-big-llm-architecture-comparison/substack-img-004.png)

Shows how MLA's low-rank compression differs structurally from both MHA and GQA; the extra matmul at decode is the cost of smaller cache footprint.

**Fig 5 — MoE module vs dense FFN** (load-bearing schematic): illustrates sparse routing of tokens through expert FeedForward blocks; DeepSeek V3's 256 experts / 9 active is the anchor example.

- Fig 10 — OLMo 2 Post-Norm vs Gemma 3 Pre+Post-Norm (supporting comparison; placement differences readable from text)
- Fig 17 — DeepSeek V3 vs Llama 4 Maverick MoE structure (supporting; key numbers in Key claims)
- Fig 35–36 — Qwen3-Next Gated DeltaNet + Gated Attention hybrid (supporting; 3:1 ratio described in Key claims §5)
- Figs 44–45 — Olmo 3 7B/32B vs Qwen3 (supporting)
- Fig 51.1–51.4 — Nemotron 3 Nano/Super with Mamba-2 hybrid and latent MoE (supporting)

*Other images decorative — substack promo cards, book ads, cross-post thumbnails.*

## Entities touched

[[DeepSeek]], [[DeepSeek-R1]], [[MLA]], [[GQA]], [[MoE]], [[Llama]], [[Llama 4 Maverick]], [[Qwen]], [[Gemma]], [[Mistral Small]], [[GPT-OSS]], [[Kimi K2]], [[OLMo]], [[GLM-4.5]], [[MiniMax M2]], [[RoPE]], [[Sebastian Raschka]]

## Topics touched

[[LLM Architectures]]

## Raw source

[magazine.sebastianraschka.com](https://magazine.sebastianraschka.com/p/the-big-llm-architecture-comparison) — living Substack article (last updated Apr 2, 2026) · ~98 KB · 23+ model sections · 74 architecture-comparison figures. Read 2026-05-15.
