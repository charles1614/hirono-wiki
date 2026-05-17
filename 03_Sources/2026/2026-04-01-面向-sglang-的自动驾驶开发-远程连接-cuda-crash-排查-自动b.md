---
created: 2026-05-12
updated: 2026-05-12
type: source
source_url: https://mp.weixin.qq.com/s/PFPgY7sa2bPcQow6fWQpFw
tags: [inference, observability, tooling]
---

# [2026-04-01] 面向 SGLang 的自动驾驶开发：远程连接、CUDA Crash 排查、自动 benchmark 与 Profile 分析

## TL;DR

A ~19 KB weixin post by **GiantPandaLLM (BBuf)** documenting four **Claude Code SKILLs** he built for "auto-driven AI Infra" — moving high-experience SGLang development tasks (remote-machine work, CUDA crash debugging, server-flag benchmark search, torch-profiler analysis) into Codex/Claude-Code-executable workflows. The four SKILLs are each open-source (at `BBuf/AI-Infra-Auto-Driven-SKILLS` + selectively in `sglang/.claude/skills/`) and verified across multiple models and machines. The theme: **agent-completed AI-infra development**, where humans curate the procedure once into a SKILL and the agent reuses it across debug/benchmark/profile cycles.

## Key claims

**1. Remote Connection SKILL** (`skills/h100`, `skills/b200`, `skills/h200-diffusion`): per-machine profile baking SSH target, default container, repo path, GPU-architecture-specific build flags into the skill. Lets a local Codex/Claude-Code session treat ANY of the remote GPU machines as a unified execution backend without per-machine agent setup. Workflows covered: `hostname` / `docker ps` / `nvidia-smi` checks, container entry, `HF_TOKEN` + HF cache + FlashInfer presence verification, detached-worktree or sync-from-local-working-tree workflows, validation pipeline (`py_compile` / `compileall` / `pytest` / GPU smoke / server-level validation). Production-meaningful primitive: the SKILL is what makes the *agent session itself* portable across heterogeneous GPU fleets.

**2. SGLang CUDA Debug Crash SKILL** (`sglang/.claude/skills/debug-cuda-crash`, PR #20910): kernel-API logging at staged verbosity:
- `SGLANG_KERNEL_API_LOGLEVEL=1` — record API call + exception boundary
- `=3` — add tensor shape / dtype / device / contiguous metadata
- `=5` — add min/max/mean + NaN/Inf statistics
- `=10` — auto-dump `inputs.pt` + `metadata.json` on exception (offline replay)

Covers `register_custom_op(...)`, `register_custom_op_from_extern(...)`, LLM attention/linear/quantization wrappers, diffusion attention/linear/rotary wrappers, `torch.ops.sglang.*` hotspots. CUDA Graph safe (skips unsafe tensor dump under graph capture but keeps call boundary logs). Inspiration cited: FlashInfer's API logging. **Concrete value**: turns a transient `device-side assert triggered` into an offline-replayable problem sample.

**3. SGLang Auto-Driven Benchmark SKILL** (PR #21736): YAML-driven server-flag search + workload benchmark closed loop. Subcommands: `run` / `convert` / `validate`. Input formats: `sharegpt` / `custom` / `random` / `generated-shared-prefix` → canonical autobench JSONL. **Search tiers**: tier 1 (smallest sanity sweep), tier 2 (balanced default), tier 3 (full sweep). **Search modes**: fixed QPS list, QPS binary search with `lower / upper / tolerance`, `max_concurrency` joint dimension. Auto-generates candidate server flags from prompt or YAML; auto-selects benchmark backend (`sglang` / `sglang-oai` / `sglang-oai-chat`). Two-stage: base + speculative (continues with EAGLE/spec-decode params). **Persistence**: writes `live_results.jsonl` during run; on interrupt preserves completed trials; `resume` skips already-run trials. Outputs: `prepared_dataset.jsonl` + `results.jsonl` + `results.csv` + `summary.md` per scenario.

**4. SGLang Torch Profiler Analysis SKILL** (`skills/sglang-torch-profiler-analysis`): unified entry script `analyze_sglang_torch_profile.py` with four subcommands replacing the previous scattered scripts. Handles: trace collection → stage split → Perfetto-render fix → kernel classification → source map → overlap-opportunity detection → fuse-opportunity detection.

**The methodological framing**: BBuf's recurring point — "把过去依赖个人经验的工作交给 Agent" (turn previously-experience-dependent work into agent-executable workflows). Each SKILL is a one-time curation of procedure + context + verification flow that becomes durable infrastructure. The four SKILLs together cover four orthogonal pain points: multi-machine env (#1), kernel debug (#2), server-flag tuning (#3), trace-to-optimization-conclusion (#4).

## Visual observations

*No load-bearing images — source has no images.*

## What this changes

A second Source from **GiantPandaLLM / BBuf** in the corpus (first was [[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]]) — establishing this author as a load-bearing voice on **SGLang production-infra + agent-automation**. The pattern across both Sources: extract operator knowledge into SKILLs that Codex/Claude Code can execute.

Updates [[SGLang]] entity with the SKILL ecosystem — both the in-tree `.claude/skills/debug-cuda-crash` location and the external `BBuf/AI-Infra-Auto-Driven-SKILLS` repo are points of presence the wiki should track.

Cross-pollination with the harness-engineering theme from [[2026-04-29-welcome-to-learn-harness-engineering-lea]] — both treat agent-workflow-as-curated-asset as the unit of infrastructure. BBuf's "SKILL" is the same category as `AGENTS.md` / `claude-progress.md` templates in the harness-engineering course.

## Raw source

> Platform: weixin · 公众号 GiantPandaLLM · 发布 2026-04-01
> Author: **BBuf** (also wrote [[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]])
> SKILL repos cited:
> - `BBuf/AI-Infra-Auto-Driven-SKILLS` (general skills)
> - `sgl-project/sglang/.claude/skills/debug-cuda-crash` (in-tree)
> - SGLang PRs: #20910 (CUDA debug crash), #21736 (auto-driven benchmark)
> Related corpus: [[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]] (same author, deeper technical recap)
