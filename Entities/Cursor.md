---
created: 2026-05-12
updated: 2026-05-16
type: entity
refs: 10
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
- Cited by [[Pine AI]]'s chief scientist as the benchmark for "AI Agent with a technical moat": Cursor's technical edge is three specialized models (Tab completion, apply-code-diff, and codebase search) that together create a proprietary barrier competitors cannot replicate from Cursor's prompt alone; Pine follows the same pattern (frontier closed model + knowledge base + SFT/RL specialized open model). — [[2025-06-14-能办成事的-agent-实时与环境交互-从经验中学习]]
- Starting 2025-04-06, official website login sessions enforce single-user exclusivity (new login kicks others); shared accounts must use 30-day access tokens; a community-built `curs0r` client with a token pool at `pool.curs0r.me` provides an alternative. — [[2025-06-09-https-share-google-link-https-linux-do-t]]
- Composer 2 technical report (March 2026): base model Kimi K2.5 (1.04T/32B active MoE), continued pretraining on code mix in MXFP8 on NVIDIA B300s then async RL; removes length std normalization from GRPO and skips advantage std normalization; introduces CursorBench-3 (median 181 lines changed, 390-char prompts) to replace SWE-bench as primary internal eval; both average and best-of-K rewards improve together, suggesting RL expands solution coverage rather than merely reweighting known paths. — [[2026-03-26-composer]]
