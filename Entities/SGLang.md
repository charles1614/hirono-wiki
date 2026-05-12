---
created: 2026-05-11
updated: 2026-05-12
type: entity
refs: 6
tier: active
---

# SGLang

Open-source LLM inference system; built on top of model-serving infrastructure; Tencent + LMSYS contributors prominent.

## Synthesis

Open-source LLM inference system (Tencent + LMSYS-affiliated contributors). 2025 H2 priorities (issue #8210) include distributed-serving enhancement, of which built-in OpenTelemetry-based request tracing (issue #8965, PR #9962) is foundational — request-centric Jaeger view + thread-centric Perfetto view + Perfetto/PyTorch-Profiler trace merging. Ships **EAGLE-3 speculative decoding in production** with **40% throughput improvement at batch size 64** (refuting the conventional wisdom that speculation degrades large-batch throughput). Anchor case in Pan & Li's 2025 survey of LLM inference systems alongside vLLM, Mooncake, and DeepFlow.

## Observations

- Issue #8965 (Aug 2025, author `sufeng-buaa`) proposes a built-in **OpenTelemetry-based request tracing framework** — request-centric Jaeger view + thread-centric Perfetto view + ability to **merge Perfetto traces with PyTorch Profiler data**. Resolves OTel's single-context-tracking limitation that continuous-batching otherwise breaks. PD-disaggregation is first-class. Issue auto-closed Nov 2025; feature shipped via PR #9962. Sub-task of the 2025 H2 Distributed Serving Enhancement roadmap. — [[2025-11-17-feature-sglang-tracing-fine-grained-trac]]
- Referenced as part of the inference-stack landscape Flux benchmarks against (Flux compares directly against vLLM; SGLang is in the broader competitive frame). — [[2025-10-09-flux-fast-software-based-communication-o]]
- Ships **production-grade EAGLE-3 integration**: 40% throughput improvement at batch size 64. The number directly refutes the assumption that speculative sampling reduces throughput at large batch — and is the headline application-level proof point for the EAGLE-3 scaling-law paper. — [[2025-10-09-eagle-3-scalingupinference-acceleration-]]
- Covered as a named LLM-inference system in Pan & Li's "A Survey of LLM Inference Systems" (arXiv:2506.21901, June 2025) alongside vLLM, Mooncake, and DeepFlow under a cs.DB framing. — [[2026-05-08-a-survey-of-llm-inference-systems]]
- **H20-96G DeepSeek production stack**: Ant Group's January 2026 meetup talk maps slide-level optimizations to upstream SGLang PRs — `#10568` TP scattered prefill, `#10953` MHA one-shot under chunked prefix, `#10567` FusedMoE TMA down-proj, `#16723` SwapAB, `#9660` SBO, `#11398/#11434` EAGLE spec-overlap + CUDA-graphed draft post-processing. Demonstrates a methodological pattern worth noting: **MoE tuning uses real-traffic `topk_ids`** rather than synthetic, and **EPLB uses co-activation matrices** rather than random init. — [[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]]
- **Claude-Code SKILL ecosystem** (in-tree at `sglang/.claude/skills/` + external at `BBuf/AI-Infra-Auto-Driven-SKILLS`): 4 SKILLs for auto-driven development — remote-machine connection, CUDA crash debug (PR #20910, staged kernel-API logging at levels 1/3/5/10), auto-driven benchmark (PR #21736, YAML-driven server-flag search + SLA + resume), Torch profiler analysis (unified entry). Methodological theme: high-experience operator work becomes agent-executable SKILLs. — [[2026-04-01-面向-sglang-的自动驾驶开发-远程连接-cuda-crash-排查-自动b]]
