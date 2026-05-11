---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://github.com/NVIDIA/TensorRT-LLM/blob/main/docs/source/blogs/tech_blog/blog9_Deploying_GPT_OSS_on_TRTLLM.md
tags: [tensorrt-llm, nvidia, gpt-oss, inference, deployment, moe, b200]
---

# [2025-08-23] Running a High Performance GPT-OSS-120B Inference Server with TensorRT-LLM

## TL;DR

[[NVIDIA]] deployment guide for serving GPT-OSS-120B on [[TensorRT-LLM]], split by operating regime: **low-latency** (max tps/user, low concurrency) vs **max-throughput** (max tps/gpu, high concurrency). Headline numbers on Blackwell silicon: **420 tps/user** (8× B200 + bs=1, low-latency) and **19.5–20k+ tps/gpu** (4× B200 / GB200 + DP4EP4, throughput regime), translating to **>1.5M tps on a GB200 NVL72**. The guide also surfaces a Hopper/Blackwell MoE-kernel split: [[TensorRT-LLM]] native MoE backend on Blackwell, **OpenAI's Triton MoE kernels** required on H200 (TRTLLM backend unsupported, CUTLASS WIP).

## Key claims

- **The tps/user vs tps/gpu axis** is the production framing: tps/user = user experience, tps/gpu = economic efficiency. They aren't on the same Pareto frontier — different configs.
- Low-latency config: `enable_attention_dp: false`, CUDA graphs on, MoE backend `TRTLLM` on Blackwell or `TRITON` on H200. Result: **420 tps/user, bs=1, 8× B200**.
- Max-throughput config: switch on attention DP, MoE expert parallelism. **batch size 640** achievable on 8× B200 at isl=1k osl=2k. Currently best: **19.5k tps/gpu on 4× B200 with DP4EP4**, **20k+ on GB200** (slightly higher per-chip), so **>1.5M tps on a GB200 NVL72** (72 chips).
- Operating-knob taxonomy surfaced: `--tp`, `--ep` (expert parallel for MoE), `--max_batch_size`, `--concurrency`, `--kv_cache_free_gpu_mem_fraction`. EP > 1 enables mixed TP/EP for MoE — recommended *small* for low-latency (avoid MoE load imbalance), *larger* for throughput.
- **MoE backend matrix is hardware-dependent**: on Blackwell (B200/GB200) → `TRTLLM` native; on Hopper (H100/H200) → must use OpenAI Triton kernels (`TRITON` backend), because `TRTLLM` backend unsupported and `CUTLASS` backend "still ongoing." Real fragmentation in the kernel stack across one-generation gap.
- TRT-LLM exposes an OpenAI-compatible HTTP API (port 8000) — so the deployment surface is interchangeable with vLLM/SGLang for clients.
- "We have a forthcoming guide for getting great performance on H100" — i.e., the GPT-OSS-120B target hardware is Blackwell first, Hopper second.
- `TRTLLM_ENABLE_PDL=1` (Programmatic Dependent Launch) enabled by default in the recipe — the same PDL primitive that [[FlashMLA]] uses to overlap kernel launches.

## Entities touched

[[NVIDIA]], [[TensorRT-LLM]], [[GPT-OSS]], [[B200]], [[GB200]], [[H200]], [[H100]], [[Triton]], [[CUTLASS]], [[OpenAI]]

## Topics touched

[[LLM Inference Systems]], [[MoE Serving]], [[Inference-Optimized Accelerators]]

## Open questions

- DP4EP4 wins on 4× B200; >4 GPU config is "suboptimal due to communication implementation" — what's the limit imposed (NVLink topology? ICI bandwidth? Reducer impl?) and when does it get fixed?
- 420 tps/user at bs=1 is impressive — but bs=1 means *zero batching concurrency*. What does tps/user look like at bs=8 with the low-latency config? (The realistic interactive load.)
- GPT-OSS-120B vs DeepSeek-V3 (671B-MoE) — the same TRT-LLM stack? The MoE backend differences (TRTLLM/TRITON/CUTLASS) suggest the kernel investment is *per model family*, not generic.
- Cross-reference [[2026-05-08-a-survey-of-llm-inference-systems]] — survey identifies disaggregation as the next system shape; this TRT-LLM guide stays in single-replica regime. When does TRT-LLM ship its disaggregation story?
- The Triton-kernels-on-Hopper detail is interesting — OpenAI's MoE kernels outperforming NVIDIA's own on NVIDIA's hardware. What's the architecture mismatch that makes that true (Triton's pipelining? specific MoE op shapes)?

## Raw source

[github.com/NVIDIA/TensorRT-LLM/blob/main/docs/source/blogs/tech_blog/blog9_Deploying_GPT_OSS_on_TRTLLM.md](https://github.com/NVIDIA/TensorRT-LLM/blob/main/docs/source/blogs/tech_blog/blog9_Deploying_GPT_OSS_on_TRTLLM.md) — full deployment guide, ~17.5 KB. Includes runnable commands for low-latency + throughput + MoE Triton-on-Hopper + troubleshooting.
