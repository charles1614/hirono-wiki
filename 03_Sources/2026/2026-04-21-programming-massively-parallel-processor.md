---
created: 2026-05-12
updated: 2026-05-12
type: source
source_url: https://shop.elsevier.com/books/programming-massively-parallel-processors/hwu/978-0-443-43900-1
tags: [gpu, survey]
---

# [2026-02-27] Programming Massively Parallel Processors, 5th Edition (Hwu / Kirk / El Hajj)

## TL;DR

Elsevier shop page for **PMPP 5th edition** — the canonical CUDA programming textbook by **Wen-mei W. Hwu** (NVIDIA Senior Director of Research + UIUC), **David B. Kirk** (NVIDIA Fellow, ex-Chief Scientist), and **Izzat El Hajj** (AUB). Published 2026-02-27. The 5th edition adds chapters that directly support modern LLM-systems work: **wavefront parallelism**, **advanced matmul optimizations**, **filtering**, **a deep-learning chapter**, **multi-GPU API (NCCL + NVSHMEM)**, plus expanded CUDA-feature coverage of **warp-level programming, cooperative groups, CUDA C++ atomics**. This Source is a **pointer**: the shop page lists TOC + authors + scope. The actual textbook content is not in raw/.

## Key claims

**New / expanded chapters in 5th edition** (vs prior eds):

- Ch. 14 **Filtering** (new) — likely covers stream-compaction and predicated kernels.
- Ch. 16 **Wavefront Algorithms** (new) — kernel patterns that move "waves" of work through a grid; relevant to scan/prefix-sum-heavy workloads.
- Ch. 19 **Multi-GPU API** (new) — explicit NCCL + NVSHMEM coverage. Worth noting: the canonical CUDA textbook now treats multi-GPU as core, not appendix.
- Ch. 18 **Deep Learning** — present (was added in earlier editions but expanded for 5e).
- Ch. 23 **Advanced Optimizations for Matrix Multiplication** (new) — likely covers TMA + warp specialization + tile scheduling at the level the book is known for.

**CUDA-feature coverage expanded**: warp-level programming, cooperative groups, CUDA C++ atomics, multi-GPU with NCCL + NVSHMEM. Reflects the post-Hopper / Blackwell programming-model shift.

**Authors' positioning**:

- **Wen-mei W. Hwu**: NVIDIA Senior Director of Research + UIUC. ACM/IEEE Eckert-Mauchly Award. Pedigree at the architecture-compiler-algorithm intersection.
- **David B. Kirk**: NVIDIA Fellow; was Chief Scientist 1997 onward. Co-author of all 5 editions.
- **Izzat El Hajj**: AUB. PhD UIUC under Hwu lineage. Bridges back to academic GPU-computing tradition.

The textbook tradition: 4-part structure (Fundamental Concepts → Parallel Patterns → Advanced Patterns → Advanced Practices) preserved through 5 editions. Conclusion + outlook chapter at the end is where the authors discuss forward direction — useful as a 2026-snapshot of "what NVIDIA's pedagogical leadership considers next."

## Visual observations

*No load-bearing images — source has no images.*

Textbook figures + diagrams exist in the book itself but were not pulled into `raw/` (Elsevier shop product page only).

## What this changes

A **canonical-reference pointer** for the wiki's GPU-programming surface area. The 5th edition's specific new-chapter list is the signal: NVIDIA's own pedagogical front (Hwu is internal at NVIDIA) is teaching wavefront-parallelism + advanced matmul + multi-GPU NCCL/NVSHMEM as standard topics by 2026. That validates the topics being load-bearing in [[Attention Kernels]] / training-side parallelism work.

Companion to the practitioner-curated **"Efficient LLM Inference Pocket Notes"** ([[2026-04-26-大模型推理八股-小红书]]) — PMPP is the textbook layer (architectural fundamentals + CUDA kernel craft), the inference-pocket-notes are the inference-systems layer (vLLM/SGLang specifics). Together they sketch the 2026 GPU-systems-engineer reading list.

## Raw source

> Publisher: Elsevier · ISBN 978-0-443-43900-1 · 5th Edition published 2026-02-27
> Authors: **Wen-mei W. Hwu** (UIUC + NVIDIA), **David B. Kirk** (NVIDIA Fellow), **Izzat El Hajj** (American University of Beirut)
> Shop URL: <https://shop.elsevier.com/books/programming-massively-parallel-processors/hwu/978-0-443-43900-1>
> Raw archive holds the structured product page (TOC + author bios + scope) but no figures; the textbook itself is not in `raw/`. Re-ingest the actual textbook (if/when fetched) as a separate Source.
