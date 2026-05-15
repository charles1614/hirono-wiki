---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 7
tier: active
---

# Claude Code

Anthropic's CLI-based AI coding agent, which accounts for 94% of activity in the vibe-replay demo dashboard (108 of 115 sessions).

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Used as the interface for 25-iteration CUDA kernel authoring loop (AutoResearch pattern); Opus 4.6 backend outperformed alternatives significantly — operator rates other models as substantially less effective for this task. — [[2026-03-23-mfu达42-opus-4-6-autoresearch-8小时实现25轮迭代自]]
- Used alongside [[OpenAI Codex]] for SGLang development under the SKILL pattern; SGLang provides in-tree Claude Code SKILLs for kernel authoring, CUDA crash debug, benchmark, and profiler analysis. GiantPandaLLM author describes Codex + GPT5.4 Extra High in this role as reaching "真正的智能" in the programming domain. — [[2026-03-24-记录下sglang开发-优化-debug的技巧之大skill时代已来临]]
- Claude Code team lead Boris publicly endorsed Ghostty terminal for parallel multi-instance workflows (5 concurrent instances); a community post cited this as the impetus for switching from iTerm2. — [[2026-03-13-claude-code团队都在使用的终端软件ghostty-小红书]]
- Karpathy named Claude Code as the first convincing demonstration of what an LLM agent looks like — a tool that loops tool use and reasoning for extended problem solving on the developer's own computer. Key distinction: runs on localhost (not cloud containers), leveraging existing computer context/data/secrets/config with low-latency interaction; "a little spirit/ghost that lives on your computer." Cited Anthropic as getting the agent-on-computer paradigm right while OpenAI initially focused on cloud deployments in containers. — [[2025-12-20-2025-llm-year-in-review]]
