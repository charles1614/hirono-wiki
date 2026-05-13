---
created: 2026-05-11
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: entity
refs: 3
tier: active
---

# TensorRT-LLM

NVIDIA's LLM-specific inference engine; built on TensorRT; competitor to vLLM/SGLang in NVIDIA-stack serving.

## Synthesis


NVIDIA's first-party LLM inference engine and the official Blackwell deployment path for gpt-oss-120b (release 1.1.0rc1). It operates in two modes from a single trtllm-serve binary: low-latency (enable_attention_dp: false, TRTLLM/TRITON MoE backend) targeting maximum tps per user, and max-throughput (enable_attention_dp: true, CUTLASS MoE backend, stream_interval: 10) targeting maximum tps per GPU — the only difference is the YAML config. Headline numbers for gpt-oss-120b on Blackwell hardware reach 420 tps/user at low-latency (8x B200, batch 1) and over 1.5 million tps system-wide on a GB200 NVL72 at max-throughput. TensorRT-LLM serves as the TransformerEngine-based comm-overlap baseline in Flux's evaluation: Flux delivers 2.06x prefill and 2.10x decoding speedups specifically over TensorRT-LLM's TransformerEngine overlap path, with the gap attributable to TransformerEngine's SM-underutilization at small batch sizes — a regression that kernel-fusion eliminates. The system is catalogued alongside vLLM, SGLang, Mooncake, and DeepFlow in Pan and Li's 2025 survey of LLM inference systems (arXiv:2506.21901), which frames inference as a database-systems problem organized around load prediction, adaptive mechanisms, and cost reduction.


## Observations

- Official NVIDIA deployment recipe for gpt-oss-120b on Blackwell — release 1.1.0rc1 (NGC container `nvcr.io/nvidia/tensorrt-llm/release:1.1.0rc1`). Two-mode design (low-latency vs max-throughput) shares a single `trtllm-serve` binary; the YAML diff is small (`enable_attention_dp` flip + MoE backend swap). Headline numbers: 420 tps/user low-latency on 8× B200 batch 1; 19.5k tps/gpu max-throughput on 4× B200; >20k on GB200; 1.5M tps system-wide on GB200 NVL72. — [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]
- Flux's evaluation baseline for tensor-parallel comm overlap — on 8× H800 NVLink, **Flux delivers 1.66× prefill / 1.30× decoding speedups over vanilla vLLM and 2.06× / 2.10× over TransformerEngine's overlap path** (which TRTLLM uses). The slowdown-vs-non-overlap regression that TransformerEngine exhibits at small m is the primary thing Flux's fused-kernel design addresses. — [[2025-10-09-flux-fast-software-based-communication-o]]
- Treated as a named LLM-serving system in Pan & Li's "A Survey of LLM Inference Systems" (arXiv:2506.21901, June 2025) alongside vLLM, SGLang, Mooncake, and DeepFlow under a cs.DB framing. — [[2026-05-08-a-survey-of-llm-inference-systems]]
