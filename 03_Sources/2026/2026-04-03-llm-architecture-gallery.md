---
created: 2026-05-12
updated: 2026-05-12
type: source
source_url: https://sebastianraschka.com/llm-architecture-gallery/
tags: [survey]
---

# [updated 2026-05-03] LLM Architecture Gallery (Sebastian Raschka)

## TL;DR

**Sebastian Raschka's live-updated catalog of open-weights and frontier-LLM architectures** rendered as side-by-side block diagrams. Last updated 2026-05-03; **63 distinct architectures** spanning GPT-2 XL (2019 baseline) through 2026-frontier entries (DeepSeek V4-Pro 1.6T, V4-Flash 284B, Kimi K2.6 1T, GLM-5.1 744B, Qwen3.6, Tencent Hy3-preview, Xiaomi MiMo-V2.5 310B, Laguna XS.2). Each architecture rendered as a vertical block diagram showing layer structure, attention variant (MHA / GQA / MLA / hybrid), MoE configuration (total / active params, expert count, shared experts), FFN width / depth, positional encoding (RoPE / variants), and context-length budget. **The gallery is the wiki's reference for "what 2026 LLM architectures actually look like"** — no single survey rivals it for breadth + visual consistency + currency. Raschka's editorial choice: side-by-side comparison only works when diagrams are normalized to the same visual vocabulary.

## Key claims

**The catalog's coverage axis (architecture families)**:

- **Dense (no MoE)**: GPT-2 XL, Llama 3 (8B/3.2/1B), OLMo 2/3 (7B/32B), Gemma 3/4 (27B/270M/31B/26B), Mistral Small 3.1/4 (24B/119B), Qwen3 (32B/4B/8B), SmolLM3 3B, GPT-OSS 20B, Gemma 3 270M, Phi-4 14B, xLSTM 7B, Tiny Aya 3.35B, Sarvam 30B/105B, Nemotron 3 Nano 4B, Mistral Large 3 673B, Gemma 4 E2B/E4B, Nanbeige 4.1 3B.
- **MoE (sparse)**: DeepSeek V3/R1 671B, V3.2 671B, V4-Flash 284B, V4-Pro 1.6T, Llama 4 Maverick 400B, Qwen3 235B-A22B / Next 80B-A3B / Coder Flash 30B-A3B / 3.5 397B / 3.6 35B-A3B & 27B, Kimi K2 1T / K2.5 / K2.6, GLM-4.5 355B / -Air 106B / -4.7 / -5 744B / -5.1, GPT-OSS 120B, Grok 2.5 270B, MiniMax M2 / M2.5 / M2.7 230B, Kimi Linear 48B-A3B, Nemotron 3 Nano 30B-A3B / Super 120B-A12B, Xiaomi MiMo-V2-Flash 309B / V2.5 310B, Arcee AI Trinity Large 400B, INTELLECT-3 106B, Step 3.5 Flash 196B, Ling 2.5 1T / 2.6 1T, Tencent Hy3-preview 295B-A21B, Laguna XS.2 33B-A3B, Granite 4.1 30B.

**Architectural-trend snapshots visible across the gallery**:

- **MoE is dominant at frontier scale** — every 2025-2026 frontier entry (≥100B) is MoE.
- **Attention variants are converging**: GQA + RoPE is the dense-model default; **MLA** (Multi-Head Latent Attention) was DeepSeek-distinctive through V3/V3.2; **V4 returns to MHA + GQA primitives with Compression Sparse Attention layered on** (per the V4-Pro / V4-Flash diagrams) — confirms the [[MLA]] retirement narrative from [[2026-04-27-deepseek-v4砍掉mla-一个月前有人预言了-小红书]] at the architectural-diagram level.
- **Hybrid attention is mainstream by late-2025**: Qwen3-Next, MiniMax, Kimi Linear use mixed full / sliding-window / linear attention patterns.
- **MoE granularity is increasing** — 2024-era 8-expert models (Mixtral) are rare in the 2026 gallery; 128+ expert + 8-active is more common.
- **Shared-experts pattern persists across vendors**: DeepSeek (V3 → V4), Qwen3, Kimi, GLM-4.5 all have at least one always-active expert shared across tokens. Reduces the "experts trained only on rare tokens" pathology.

**Notable curiosities Raschka surfaces**:

- DeepSeek V3 and R1 share the same architecture (V3/R1 671B image is shared) — R1 is post-training of V3, not a separate architecture.
- Granite 4.1 30B is IBM Research's late-2025 entry — newly catalogued here.
- xLSTM 7B is the only non-transformer family in the gallery as of 2026-05.

## Visual observations

64 architecture diagrams (`sebastianraschka-img-001.png` through `…-img-064.png`). All are real block-diagram visualizations of LLM architectures — none decorative. Four diagrams below are referenced as the load-bearing visual anchors for the wiki's most-cited entities.

**DeepSeek V3 / R1 (shared, 671B)** (`../../raw/raindrop/sebastianraschka.com/2026-04-03-llm-architecture-gallery/images/deepseek-v3-r1-671-billion.webp`)

![DeepSeek V3/R1 671B architecture block diagram: MLA (Multi-Head Latent Attention) + DeepSeek-MoE with 256 routed experts + 1 shared expert; RoPE; 61 layers; R1 inherits the V3 architecture (R1 is post-training, not a separate model)](../../raw/raindrop/sebastianraschka.com/2026-04-03-llm-architecture-gallery/images/deepseek-v3-r1-671-billion.webp)

The architecture behind the V3/R1 era — MLA + fine-grained 256-expert MoE with one shared expert.

**DeepSeek V4-Pro** (`../../raw/raindrop/sebastianraschka.com/2026-04-03-llm-architecture-gallery/images/deepseek-v4-pro.webp`)

![DeepSeek V4-Pro architecture: hybrid attention (Compression Sparse Attention CSA + Highly Compressed Attention HCA) replacing MLA; on-disk KV cache; MTP head; expanded shared-expert + routed-expert MoE; 1.6T total params](../../raw/raindrop/sebastianraschka.com/2026-04-03-llm-architecture-gallery/images/deepseek-v4-pro.webp)

V4-Pro removes MLA in favor of CSA+HCA. Confirms the xhs interpretation Source ([[2026-04-27-deepseek-v4砍掉mla-一个月前有人预言了-小红书]]) at the architecture-diagram level.

**Kimi K2 (1T)** (`../../raw/raindrop/sebastianraschka.com/2026-04-03-llm-architecture-gallery/images/kimi-k2-1-trillion.webp`)

![Kimi K2 1T architecture: MoE with extreme expert count (~384 routed + shared); MLA-style attention; long-context positional encoding; the first 1T-param open-weights model](../../raw/raindrop/sebastianraschka.com/2026-04-03-llm-architecture-gallery/images/kimi-k2-1-trillion.webp)

First 1T-param open-weights model. The gallery traces K2 → K2.5 → K2.6 as a coherent architecture lineage.

**GPT-OSS 120B** (`../../raw/raindrop/sebastianraschka.com/2026-04-03-llm-architecture-gallery/images/gpt-oss-120b.webp`)

![GPT-OSS 120B architecture: OpenAI's open-weights MoE entry; layer / expert / attention-variant configuration as catalogued by Raschka](../../raw/raindrop/sebastianraschka.com/2026-04-03-llm-architecture-gallery/images/gpt-oss-120b.webp)

OpenAI's open-weights MoE design point. Visual reference for the production-serving recipe in [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]].

## What this changes

The **single most-cited reference page** for the wiki going forward. Every Source that touches a specific model architecture should cross-link this gallery for the "show me what it looks like" answer. Specific updates:

- [[LLM Inference Systems]]: gallery is now the canonical visual cross-reference for any architecture mentioned in inference-system synthesis.
- [[MoE Serving]]: the gallery makes visible the MoE-design-space (expert count, shared-expert ratio, hybrid-attention pairings) that this Topic discusses abstractly. Worth a dedicated cross-reference paragraph.
- [[Attention Kernels]]: kernel design follows attention-variant choice; the gallery is the catalogue of which variant each model uses, so the matching kernel claim chain is now visualizable.
- **DeepSeek V4 retirement of MLA** ([[2026-04-27-deepseek-v4砍掉mla-一个月前有人预言了-小红书]]) is now corroborated visually — Raschka's V4-Pro / V4-Flash diagrams render the CSA+HCA composition rather than MLA, validating the xhs interpretation piece at the diagram level. Treat this gallery's V4-Pro entry as authoritative until V4's actual tech-report PDF is ingested.

**Open thread**: Raschka updates the gallery continuously (last-updated 2026-05-03). The wiki's snapshot captures it at one point. Worth re-fetching periodically (~quarterly) to keep the architecture corpus current; flag for the operator workflow as a recurring re-fetch.

## Raw source

> Author: **Sebastian Raschka** (sebastianraschka.com)
> Page: <https://sebastianraschka.com/llm-architecture-gallery/>
> Last updated: 2026-05-03 (live; re-fetch ~quarterly)
> Coverage: 64 architecture diagrams (~63 distinct architectures — V3 and R1 share one)
> Image extraction: Sonnet subagent pass; verbatim per-diagram details at `<slug>-images-extract.md`
> Related corpus: [[2026-04-27-deepseek-v4砍掉mla-一个月前有人预言了-小红书]] (V4 retiring MLA — confirmed visually), [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] (GPT-OSS 120B production serving), [[MLA]] (entity, references this gallery), [[MoE Serving]] (Topic, cross-references)
