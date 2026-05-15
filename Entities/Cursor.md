---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 6
tier: active
---

# Cursor

AI-powered code editor with a CLI mode supported by vibe-replay for session capture and replay, accounting for 6% of demo activity.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- **Composer 2** trains inside the exact production Cursor harness (same tools, prompt, system message) via a shadow deployment of the backend; uses GRPO variant (removes length standardization; skips advantage normalization by std dev) on Firecracker VMs (Anyrun, 500+ pods/sec, filesystem snapshotting); Multi-Token Prediction (MTP) layers provide 2–3× inference speedup via self-distillation. — [[2026-03-30-how-kimi-cursor-and-chroma-train-agentic]]
- **Real-time RL loop** runs in ~5 hours end-to-end (collect production tokens → distill reward → train → CursorBench eval → deploy), enabling multiple checkpoint deploys per day. CursorBench tasks have median 181 lines changed vs. 7–10 on SWE-bench. — [[2026-03-30-how-kimi-cursor-and-chroma-train-agentic]]
- Karpathy identified Cursor's "meteoric rise" in 2025 as revealing a new thick "LLM app" layer: apps bundle context engineering, multi-LLM-call DAG orchestration, application-specific GUI, and an "autonomy slider." This spawned "Cursor for X" conversations — LLM labs provide a capable college student; LLM apps organize and deploy them as professionals in specific verticals via private data, sensors, actuators, and feedback loops. — [[2025-12-20-2025-llm-year-in-review]]
