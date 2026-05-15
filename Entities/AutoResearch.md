---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 6
tier: active
---

# AutoResearch

agentic research framework by Karpathy

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Core pattern: `program.md` (or `optimization_rules.md`) defines evaluation setup, success criteria, and iteration constraints; model can only modify a specified scope (e.g., `csrc/`); locked eval harness (e.g., `run.py`) enforces correctness. Model self-iterates: run → profile → analyze → improve, with no human in the loop except strategic nudges. — [[2026-03-23-mfu达42-opus-4-6-autoresearch-8小时实现25轮迭代自]]
- Successfully applied to CUDA kernel authoring (not just ML training): Claude Opus 4.6 completed 25 iterations producing a Flash Attention with custom mask kernel at 25.17 TFLOPS (MFU 42%) on RTX 3080, beating Triton/cuDNN/FlashInfer in 8 cumulative hours at ¥30 cost. — [[2026-03-23-mfu达42-opus-4-6-autoresearch-8小时实现25轮迭代自]]
- Community practitioners report the key precondition is correct reward specification: "评判标准得想清楚。标准不对，AI 优化方向就偏了" (if the criterion is wrong, the agent optimizes in the wrong direction). Community variants include Claude Autoresearch, AutoResearchClaw (idea-to-paper pipeline), AutoKernel (CUDA kernel optimization), and autoresearch-agents (LangChain founder). — [[2026-03-24-全自动科研-真的建议早点接触-小红书]]
