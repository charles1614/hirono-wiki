---
created: 2026-05-12
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 1
---

# Pretraining

## What

Initial large-scale training of foundation models on diverse text corpora before downstream fine-tuning.

## Current understanding

Pretraining is the initial large-scale training phase in which a foundation model learns general representations from a massive, diverse text corpus — typically hundreds of billions to trillions of tokens drawn from web crawls, books, code repositories, and curated datasets. The objective is almost universally next-token prediction (autoregressive language modeling), though masked-language-modeling variants (BERT-style) and mixture objectives have also been used. The central insight is that predicting held-out tokens at scale forces the model to internalize syntax, factual associations, reasoning patterns, and world structure, producing a general-purpose representation that downstream fine-tuning stages can cheaply specialize.

**Data composition and quality filtering** are widely recognized as more impactful than raw compute at a fixed budget. Sources consistently emphasize that deduplication, quality heuristics (perplexity filtering, domain weighting), and deliberate over-sampling of high-signal domains (code, math, scientific text) materially improve downstream task performance — often more than proportional increases in parameter count or training tokens.

**Scaling laws** (Chinchilla and successors) establish that optimal compute allocation requires training tokens to scale roughly linearly with parameter count. Under-trained large models were the norm before Chinchilla; post-Chinchilla practice shifts toward smaller models trained on significantly more tokens, trading inference-time cost for training efficiency. More recent work probes the "overtrained" regime, showing that inference-optimal and training-optimal frontiers diverge: models trained well past the Chinchilla-optimal token count remain practical when inference volume justifies the upfront compute.

**Architecture** is now largely standardized around the decoder-only transformer with rotary positional embeddings, grouped-query attention, and SwiGLU or similar gated activations. Encoder-only and encoder-decoder variants persist in specialized niches but are not the dominant pretraining architecture for general-purpose LLMs.

**Tokenization** choices (vocabulary size, BPE vs. unigram, multilingual coverage) have outsized effects on downstream multilingual and code performance and are increasingly treated as a first-class design decision rather than an afterthought.

No sources are yet attached to this topic. Claims above reflect cross-source consensus visible in the broader literature; they will be refined and attributed as Sources accumulate.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
