---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://www.gilesthomas.com/2025/12/llm-from-scratch-28-training-a-base-model-from-scratch
tags: [llm-training, pretraining, developer-experience]
---

# [2025-12-02] Writing an LLM from scratch, part 28 — training a base model from scratch on an RTX 3090

## TL;DR
Giles Thomas trained a 163M-parameter GPT-2 small equivalent base model from scratch on his personal RTX 3090 in just over 48 hours, using HuggingFace FineWeb-Edu as the dataset, achieving near-GPT-2-small quality. The post documents the full experiment workflow including data selection, tokenization, and training configuration.

## Key claims
- A GPT-2 small architecture (163M params: `emb_dim=768`, `n_heads=12`, `n_layers=12`, `context_length=1024`) can be trained to near-GPT-2-quality on a single consumer RTX 3090 in ~48 hours.
- Dataset used: HuggingFace FineWeb-Edu 10B token sample (~27 GiB), selected over plain FineWeb 10B because educational-quality filtering produces noticeably cleaner text.
- GPT-2 pre-training data was ~40 GB of text (~10B tokens scraped from Reddit-upvoted pages); FineWeb 10B sample is order-of-magnitude comparable.
- Batched tokenization via `tiktoken.encode_batch` with `num_proc=24` reduced processing time from ~36 minutes to ~3 minutes for the 14.8M-document FineWeb dataset.
- Andrej Karpathy's nanochat uses [[PyTorch]] (not C/CUDA llm.c) and trained a 561M-parameter d20 model in ~4 hours on 8× H100 at ~$24/hr; the author used this as a benchmark for feasibility at 163M params.
- Weight-tying (reusing embedding matrix as output head) was deliberately avoided; author cites Raschka's recommendation that independent weights perform better.
- The article is part of a longer "LLM from scratch" series following Sebastian Raschka's book.

## Visual observations
*No load-bearing images — code-focused walkthrough with no charts or diagrams.*

## What this changes
Demonstrates that consumer GPU (RTX 3090) base model pretraining is viable for GPT-2 scale, which has been largely assumed to require multi-GPU cloud setups. Strengthens the [[Minimal-Implementation Pedagogy]] thesis that full LLM training is accessible to individuals.

## Entities touched
[[PyTorch]], [[Llama]]

## Topics touched
[[LLM Pretraining]], [[Minimal-Implementation Pedagogy]], [[Educational LLM Tooling]]

## Raw source
[www.gilesthomas.com/2026-02-07-writing-an-llm-from-scratch-part-28](https://www.gilesthomas.com/2025/12/llm-from-scratch-28-training-a-base-model-from-scratch) — personal blog post by Giles Thomas, published 2025-12-02. Read 2026-05-15.
