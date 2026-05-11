---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://arxiv.org/pdf/2406.06858
tags: [communication-overlap, tensor-parallelism, kernel-fusion, bytedance, megatron, vllm, gpu]
---

# [2025-10-09] FLUX: Fast Software-Based Communication Overlap on GPUs Through Kernel Fusion

## TL;DR

[[ByteDance]] + Peking U paper (arXiv:2406.06858, last rev Oct 2024) — a tensor-parallelism communication-overlap technique that **fuses comm into a larger kernel** via overdecomposition + intra-kernel scheduling, hiding **up to 96% of TP communication**. Numbers: **1.24× training speedup over Megatron-LM** on 128 GPUs, **1.66× prefill / 1.30× decoding speedup over vLLM** on 8 GPUs. Beats TransformerEngine's prior overlap method by **1.38×–2.10×** across train/prefill/decode. Tested across GPU generations (A100 PCIe, A100 NVL, H800 NVL).

## Key claims

- **The problem**: tensor parallelism (TP) introduces AllReduce / ReduceScatter / AllGather between layers; on a node-internal cluster (NVLink) it's a meaningful runtime fraction. Fig 1 quantifies this for GPT-3 175B and Llama-2 70B across A100 PCIe / A100 NVL / H800 NVL — non-overlapped comm is a substantial chunk in training, prefill, and decode-64/512 workloads.
- **Prior approach (TransformerEngine):** split GEMM into chunks, interleave with comm ops, schedule by stream — best-effort overlap at the *operation* level. Loses GPU efficiency because the partial-GEMM chunks underutilize the SMs.
- **FLUX's approach:** **overdecompose** comm + compute into fine-grained tile-level ops, then **fuse them into a single larger kernel**. The fused kernel handles both arithmetic + comm in its inner loop — comm becomes part of the kernel's pipelined data flow, not a stream-level afterthought. Maintains GEMM efficiency (no sub-tile waste) while keeping the overlap window full.
- **Headline numbers (training, 128 GPUs, 2DP × 8PP × 8TP):**
  - GPT-3 175B / Llama-2 70B
  - vs Megatron-LM (non-overlapped): up to **1.24× speedup**
  - vs TransformerEngine (prior overlap): up to **1.38× speedup**
- **Headline numbers (inference, 8 GPUs, 8-way TP):**
  - Prefill: up to **1.66× over vLLM**; **2.06× over TransformerEngine**
  - Decode (batch 64 + 512): up to **1.30× over vLLM**; **2.10× over TransformerEngine**
- **Comm-overlap efficiency: up to 96%.** "Given a fused kernel, FLUX can potentially overlap up to 96% of communication" — i.e., the comm cost is almost entirely hidden inside compute.
- **Why fusion wins (vs operation-level overlap):** Fine-grained over-decomposition lets each "tile" of a GEMM partial-sum trigger its corresponding comm chunk inline. The kernel's scheduling unit becomes the tile, not the operation — no stream-bridging overhead, no GEMM-efficiency loss from sub-chunk partials, no false dependency stalls.
- **Tested combinations.** Different TP comm patterns (AllReduce, ReduceScatter, AllGather), different GPU + interconnect mixes (PCIe / NVLink / NVSwitch / H800-NVL). Generalizes; not a one-architecture trick.
- **Implementation: NVIDIA CUTLASS-based kernel templates** (the paper builds on CUTLASS's tile-based scheduling primitives). Cross-ref: this means FLUX runs on the same kernel-authoring substrate as [[FlashAttention]] / [[FlashMLA]].

### Speedup table (FLUX vs baseline, reproduced from paper §8 results)

| Setting | vs non-overlap (Megatron/vLLM) | vs TransformerEngine |
|---|---|---|
| Training (GPT3 175B / Llama2 70B, 128 GPUs) | **1.24×** | 1.38× |
| Inference prefill (8 GPUs, 8-way TP) | **1.66×** | 2.06× |
| Inference decode (batch 64+512, 8 GPUs) | **1.30×** | 2.10× |

## Visual observations

**Fig 1 — Non-overlapped TP communication fraction across workloads** (load-bearing — the case for the paper)

![TP communication fraction across 8 workloads × 3 hardware configs — A100 PCIe (red) shows 40-75% comm time; A100 NVL (green) 10-25%; H800 NVL (blue) 20-50%](../../raw/raindrop/arxiv.org/2025-10-09-flux-fast-software-based-communication-o/2025-10-09-flux-fast-software-based-communication-o-figures/figure-001.png)

Bar chart for GPT-3 175B + Llama-2 70B × {Training, Prefill, Decode 64, Decode 512} × {A100 PCIe, A100 NVL, H800 NVL}. **The headline takeaway is the A100 PCIe (red) numbers** — 65-75% of prefill / 40-50% of decode is TP communication on slow interconnects, making comm overlap *first-order* for non-NVLink deployments. Even on H800 NVL (the fastest tier), TP comm is consistently 20-50% of normalized time. Without this chart, the speedup claims sound like edge optimization; with it, comm-overlap is core to the workload.

- **Fig 3 — Prior GEMM-ReduceScatter overlap with 2-way TP** — Illustration of how operation-level overlap works (and where its overhead comes from). See PDF for exact page. Supporting (context for why fusion is better than scheduling).
- **Fig 4 — PyTorch (non-overlap) vs TransformerEngine (prior overlap) efficiency** — Shows TE's overlap efficiency vs PyTorch baseline. See PDF. Supporting.

## Entities touched

[[ByteDance]], [[Megatron-LM]], [[vLLM]], [[Transformer Engine]], [[CUTLASS]], [[NVLink]], [[A100]], [[H800]], [[Llama]], [[GPT-3]]

## Topics touched

[[Communication Overlap]], [[Kernel Authoring Languages]], [[Tensor Parallelism]], [[Attention Kernels]]

## Open questions

- 96% overlap is the "best case given a fused kernel" — what fraction of TP-using workloads actually hit the fused-kernel-applicable shape? GEMM-heavy yes; what about MoE expert routing or attention with KV-cache-driven sparsity?
- TransformerEngine numbers in the comparison are 2024-era; NVIDIA has continued investing. Has TE caught up with kernel-fusion-based overlap (or borrowed FLUX's approach)?
- Cross-ref [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]: FlashMLA's seesaw scheduling solves a different but related problem (overlap CUDA Core + Tensor Core within a kernel). FLUX overlaps comm + compute *across* kernel boundaries by fusing them. Composable? Or does adopting FLUX preclude FlashMLA-style intra-kernel scheduling?
- **Inference numbers (1.66× prefill, 1.30× decode) are highly relevant to disaggregated serving** ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) — the Beyond-the-Buzz paper assumes existing comm bandwidth is enough; FLUX shows the *compute-side* comm-overlap is also a meaningful lever, possibly stacking with disaggregation.
- ByteDance + PKU collaboration ships into ByteDance's production stack (presumably). When does this land in upstream vLLM / SGLang / TensorRT-LLM?

## Raw source

[arxiv.org/abs/2406.06858](https://arxiv.org/abs/2406.06858) — full PDF preserved at `raw/raindrop/arxiv.org/2025-10-09-flux-fast-software-based-communication-o/2025-10-09-flux-fast-software-based-communication-o.pdf` (3.3 MB). 11 authors from ByteDance + Peking U; first authors Li-Wen Chang, Wenlei Bao, Qi Hou, Chengquan Jiang, Ningxin Zheng, Yinmin Zhong, Xuanrun Zhang.
