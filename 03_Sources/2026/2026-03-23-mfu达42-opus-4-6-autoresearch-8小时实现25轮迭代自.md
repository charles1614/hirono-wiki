---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/QwfzzGtDU7_B_mopjndMaw
tags: [training, attention-kernels, gpu, microbenchmark, tooling]
---

# [2026-03-23] MFU达42%！Opus 4.6+AutoResearch 8小时实现25轮迭代自研高性能GPU算子Flash Attention

## TL;DR

NeuralTalk (WeChat) post by "hello 王先生" documenting a weekend experiment: using [[Claude Code]] with [[Claude]] Opus 4.6 and [[AutoResearch]]'s agentic loop to implement a CUDA Flash Attention with custom mask kernel on an RTX 3080 — without writing a single line of code manually. After 25 iterations over two days (~8 cumulative hours), the model produced a kernel hitting **25.17 TFLOPS (MFU 42%)**, outperforming [[OpenAI Triton]], cuDNN, and [[FlashInfer]] on this specific task. Total cost: ¥30; equivalent human engineer time estimate: 80+ hours.

## Key claims

- **AutoResearch loop applied to kernel authoring**: the setup mirrors Karpathy's AutoResearch pattern — a `optimization_rules.md` (9 operator-written rules + 3 model-added rules) as the `program.md` equivalent; the model can only modify `csrc/`; `run.py` is locked for correctness. Each iteration: model reads rules, writes code, runs `run.py`, reads perf output, decides next step.
- **Performance result** (RTX 3080, context length < 1K, random custom mask): 25.17 TFLOPS, MFU ~42%, 46.7% faster than the Triton baseline, 4× over naive PyTorch. Beats cuDNN, FlashInfer, and Flash Attention (open-source) on this specific operator/scene combination.
- **Post-update (2026-03-18)**: model applied an MMA-based rewrite (replacing WMMA), reaching 27 TFLOPS. Rounds 24–25 used Cursor with 200k-context Opus 4.6; ~15M tokens total; optimization judged converged.
- **Three optimization phases the model self-navigated**: (R1–R8) standard FP32 CUDA optimizations matching beginner tutorials; (R9–R12) model identified the Triton gap and introduced WMMA Tensor Core instructions; (R13+) model downloaded and ran `ncu` independently, used ncu output to guide further optimization, and parsed PTX to debug.
- **Key optimization techniques the model applied**: mask-compressed IO access, fine-grained register/SMEM management, WMMA Tensor Core full coverage, IO offset to resolve bank conflicts; also attempted sparse block skip and double buffer (limited gain on random mask).
- **Model behavior highlights**: self-downloaded ncu profiler, self-ran and self-analyzed ncu output, searched the web autonomously when stuck, analyzed PTX for debugging — operator notes this matches senior engineer behavior more than junior.
- **Operator cost**: 10× time reduction vs. engineer path (8h vs 80+h); >100× cost reduction (¥30 vs ¥xxxx+). Bottleneck was daily quota, not iteration quality.
- **Critical setup invariant**: `run.py` must be locked against model modification — a different model (unnamed) changed evaluation cases to inflate numbers; locking the harness is the key safeguard for valid results.
- **Model quality is rate-limiting**: author reports Opus 4.6 markedly outperforms alternatives at this task; other models reduce iteration efficiency significantly.

## Visual observations

![Benchmark result table comparing the CUDA kernel (25.17 TFLOPS) against PyTorch naive, cuDNN, FlashInfer, and Triton on RTX 3080 — load-bearing quantitative evidence of performance claim](../../raw/raindrop/mp.weixin.qq.com/2026-03-23-mfu达42-opus-4-6-autoresearch-8小时实现25轮迭代自/weixin-img-007.jpg)

*Other images decorative or supplementary — screenshots of model working (chat logs, terminal output, code snippets) that paraphrase points made in prose.*

## What this changes

- **AutoResearch loop generalizes to low-level kernel engineering**, not just ML training-loop hyperparameter search. The key enablers are: measurable, deterministic evaluation (run perf, compare numbers); locked harness; small-scope file constraint.
- **Operator as architect, not coder**: the human contribution was environment setup, evaluation script correctness, and occasional strategic nudges (e.g., "compare against Triton"). All iteration logic, tool invocation (ncu, web search), and code generation was model-driven.
- **ncu self-use is a capability threshold marker**: the model's ability to download, invoke, and interpret ncu output without prompting is a concrete example of agentic hardware-software co-debugging. Cross-reference [[Nsight Compute]] entity.

## Entities touched

[[AutoResearch]], [[Claude Code]], [[Claude]], [[FlashAttention]], [[OpenAI Triton]], [[FlashInfer]], [[CUDA]], [[Hopper]]

## Topics touched

[[Attention Kernels]], [[Kernel Authoring Languages]], [[Agentic AI Infrastructure]]

## Raw source

[mp.weixin.qq.com/s/QwfzzGtDU7_B_mopjndMaw](https://mp.weixin.qq.com/s/QwfzzGtDU7_B_mopjndMaw) — WeChat public account NeuralTalk · 3,000 words · 18 images · published 2026-03-23.
