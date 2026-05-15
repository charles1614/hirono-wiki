---
created: 2026-05-15
updated: 2026-05-15
type: topic
source_count: 2
---

# LLM Architectures

## What

The structural design space of decoder-only transformer-based LLMs: attention mechanisms, expert routing, normalization placement, positional encoding, and hybrid-attention strategies. This topic tracks which architectural components became standard, which diverged across model families, and which represent active experiments in the 2024–2026 generation of open-weight frontier models.

## Current understanding

The 2025–2026 cohort of open-weight frontier models (DeepSeek V3, Llama 4, Qwen3, Gemma 3/4, Mistral 3, Kimi K2, GPT-OSS, GLM-4.5, MiniMax M2, Nemotron 3, OLMo 3) shares a common baseline — post-GPT-2 Pre-Norm transformer with RoPE, SwiGLU FFN, and GQA — but diverges on four axes:

**1. MoE vs dense.** MoE is now the dominant paradigm for models above ~30B parameters. Nearly every flagship uses it, with DeepSeek V3's architecture (MLA + sparse MoE, 256 experts / 9 active) becoming a de facto reference: Kimi K2 and Mistral 3 Large both adopted it with minor modifications. The key MoE design variables are: expert count / size (trend toward many small experts per DeepSeekMoE paper), shared-expert presence (DeepSeek V3 / GLM-4.5 / Grok 2.5 yes; Qwen3 / MiniMax M2 no), and alternation strategy (DeepSeek uses MoE in nearly all blocks; Llama 4 alternates dense and MoE every other block).

**2. Attention compression: MLA vs GQA.** Two strategies co-exist. GQA (Llama, Gemma, Qwen3, Mistral Small, GPT-OSS, MiniMax M2) shares K/V heads across query groups; it is simpler, well-supported by FlashAttention, and widely adopted. MLA (DeepSeek V3/V3.2, Kimi K2, GLM-4.5, Kimi Linear) compresses K/V into a low-dimensional latent — DeepSeek's own ablations show MLA outperforms MHA in modeling quality while GQA slightly underperforms, but MLA is more complex to implement and has disaggregation-specific overhead (redundant projections in chunked piggybacked serving). Notably, DeepSeek V4 retired MLA in favor of Compression Sparse Attention + on-disk KV cache, suggesting the field is pivoting from per-token KV compression to sequence-dimension compression.

**3. Efficiency overlays on standard attention.** Sliding window attention (local 5:1 or 3:1 global:local ratio) is used by Gemma 3/4, Xiaomi MiMo, GPT-OSS, Arcee Trinity, and Olmo 3 to reduce KV-cache size. QK-Norm (RMSNorm on Q and K before RoPE) is adopted by OLMo 2/3, Gemma 2/3, Qwen3, and MiniMax M2 for training stability. NoPE (omitting RoPE in selected layers) appears in SmolLM3, Arcee Trinity, and Kimi Linear to improve length generalization. GPT-OSS added attention-sink bias logits (learned per-head bias appended to attention scores) — a mechanism last seen in GPT-2.

**4. Linear attention hybrids (late-2025 wave).** Qwen3-Next and Kimi Linear combine Gated DeltaNet blocks (O(n) fast-weight recurrence) with full-attention layers in a 3:1 ratio, targeting million-token context efficiency. NVIDIA Nemotron 3 uses Mamba-2 sequence-modeling blocks interleaved with MoE FFN layers with only sparse full-attention layers. MiniMax M1 used lightning attention (another linear variant) but MiniMax M2 reverted to full attention, citing poor reasoning and multi-turn accuracy — the first documented production regression of linear attention at scale.

**Multi-Token Prediction (MTP)** has become a mainstream training signal (DeepSeek V3/V3.2, GLM-4.5, Qwen3-Next, Xiaomi MiMo) and is increasingly used at inference time: Nemotron 3 Super uses its shared-weight MTP head as a native speculative-decoding draft model.

Normalization placement remains architecturally contested: Pre-Norm (GPT-2 / Llama / most defaults), Post-Norm (OLMo 2/3, for training stability), Pre+Post combined (Gemma 3/4), and depth-scaled sandwich norm (Arcee Trinity with depth-dependent second-RMSNorm gain).

The broader pattern Raschka identifies: the decisive differentiators in 2025 are training pipeline and inference scaling rather than the base architecture. The structural similarity across labs makes DeepSeek V3 / Qwen3 / GPT-OSS largely interchangeable at the architectural level; the real divergence is in training data, post-training RL strategies, and inference-time compute.

**DeepSeek V3.2 sparse attention overlay (Dec 2025).** DeepSeek V3.2-Exp and V3.2 add a third efficiency layer on top of MLA: DeepSeek Sparse Attention (DSA). DSA uses a lightning indexer (per-query relevance scores over compressed MLA latents) plus a token selector (top-k=2048) to restrict each token's attention to a learned sparse subset of past tokens, cutting complexity from O(L²) to O(Lk). Notably, DSA is composited with MLA — both mechanisms run in the same model, addressing orthogonal inefficiencies (per-token KV compression vs which tokens are attended). This contrasts with DeepSeek V4's later move to retire MLA entirely in favor of Compression Sparse Attention.

— [[2026-01-28-the-big-llm-architecture-comparison]], [[2025-12-04-a-technical-tour-of-the-deepseek-models-]]

## Open threads

- Does shared-expert MoE reliably outperform no-shared-expert? Qwen3 dropped it, Qwen3-Next re-added it. Kimi's team suggested it may simply not have been necessary at 8+ experts. Will Qwen4 / DeepSeek V5 resolve this empirically?
- Where does the MLA → Compression Sparse Attention transition settle? DeepSeek V4 walked away from MLA; other MLA adopters (Kimi K2, GLM-4.5) haven't yet followed. Is per-token KV compression a dead end above 1M context?
- Can linear attention (Gated DeltaNet, Mamba-2) close the reasoning quality gap at scale? MiniMax M2's reversion is a cautionary signal; Kimi Linear's 48B positive results are encouraging but much smaller than Kimi K2.

## Sources drawn on

- [[2026-01-28-the-big-llm-architecture-comparison]] — Raschka's living survey covering 23+ model architectures, Jan 2026 through Apr 2026; primary evidence for this topic.
- [[2025-12-04-a-technical-tour-of-the-deepseek-models-]] — Raschka deep-dive on DeepSeek V3→V3.2 lineage; evidence for DSA sparse attention composition with MLA.
