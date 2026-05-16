---
created: 2026-05-12
updated: 2026-05-16
type: entity
refs: 21
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
- A pre-flight API call to `ANTHROPIC_SMALL_FAST_MODEL` (default: Haiku 3.5) gates every Bash tool invocation; when that model returns 403 AccessDeniedException (e.g., Bedrock model access not enabled), the call silently retries and hangs for ~210 seconds before the permission prompt appears — making Bash effectively unusable. Fix: enable Bedrock model access for Haiku 3.5 or set `ANTHROPIC_SMALL_FAST_MODEL` to a permitted model. A diagnostic log message was added post-fix. — [[2025-10-29-significant-pre-execution-delay-210s-whe]]
- Internal Anthropic teams use Claude Code as the primary interface for codebase navigation, incident debugging, testing automation, and prototyping; notable non-engineering adoption includes Legal building phone-tree routing tools and Growth Marketing building sub-agent workflows that generate hundreds of ad variations in minutes. Data scientists build full TypeScript React visualizations via one-shot prompting without knowing TypeScript. Security Engineering cut incident resolution to 3× faster with stack trace analysis. The key adoption pattern: treat Claude Code as a "thought partner," not a code generator. — [[2025-07-25-how-anthropic-teams-use-claude-code-anth]]
- Linux.do community discussion on sub-agent CLAUDE.md best practices: split global CLAUDE.md (`~/.claude/`) for base rules vs project-level for specifics; sub-agents should live in `.claude/agents/` (not in CLAUDE.md directly); agent config changes require restarting Claude Code to take effect; community recommends keeping CLAUDE.md minimal (base rules only) since it's sent every round-trip. — [[2025-07-29-基于claude-code新出的功能sub-agent-写了个动态生成的clau]]
- wshobson/agents provides 185 specialized agents, 153 skills, and 16 workflow orchestrators in 80 single-purpose plugins; three-tier model strategy assigns Opus 4.7 (80.8% SWE-bench, 65% fewer tokens on complex tasks) to 42 critical agents and Haiku 4.5 to 18 fast operational agents; progressive skill disclosure loads ~1,000 tokens per plugin install, not the full marketplace. — [[2025-10-30-wshobson-agents-intelligent-automation-a]]

- File read limit of 25,000 tokens is intentional (issue #4002, closed Dec 2025): prevents single large-file reads from consuming the full context window and triggering compaction; the model can still read entire files via multiple reads with `offset`/`limit`. MCP tool output is separately configurable via `MAX_MCP_OUTPUT_TOKENS` env var. — [[2025-11-27-error-file-content-28375-tokens-exceeds-]]
- Community ecosystem for extending Claude Code: Tresor (8 autonomous skills + 8 expert agents + 4 slash commands, MIT), Skill Factory (generates custom domain skills from prompts), Claude Skills Library (26+ domain packages). Skills install to `~/.claude/skills/`, agents to `~/.claude/agents/`, commands to `~/.claude/commands/`. — [[2025-11-13-ultimate-guide-to-extending-claude-code-]]
- Alibaba Cloud developer practitioner retrospective: describes Claude Code as "one master model + 15 tools" (file edit, bash, grep/glob, web search, task list); recommends CO-STAR + pseudo-XML prompt structure; advocates `git worktree` for parallel instances; warns against running multiple instances in the same working directory (file conflicts); key techniques: `/compact` for context management, per-module CLAUDE.md files (deepest-directory-first lookup). — [[2025-07-30-如何用ai-coding和claude-code提升开发效率-看我的全流程复盘]]
- linux.do community thread shared `claude_proxy.sh` (bash script) to route Claude Code through any OpenAI-compatible API proxy by patching `ANTHROPIC_BASE_URL` and `ANTHROPIC_API_KEY` in `~/.claude/settings.json`; used tbai.xin/v1 as community endpoint with Gemini-2.5-Pro and gpt-4o-mini; predecessor thread had HAIKU hard-coded to a shared TBAI key. — [[2025-07-03-claude-code-平权计划-接入api-key-model-直接使用-开发]]
- Earlier linux.do post (topic/761806) introduced the same approach with a simpler single-script pattern routing Claude Code to a Cloudflare Worker proxy; community confirmed Gemini and other models work as drop-in backends, though tool-calling capability was noted as weaker than native Claude. — [[2025-07-03-平平无奇-tbai_claude-code-实现自由-福利羊毛-linux-do]]
- A Dockerized proxy `lie5860/claude-code-proxy` (based on `fuergaosi233/claude-code-proxy`) routes Claude Code's API calls to any OpenAI-compatible endpoint via environment variables `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `BIG_MODEL`, and `SMALL_MODEL`; multi-arch (amd64/arm64); Claude Code pointed to local proxy via `ANTHROPIC_BASE_URL=http://127.0.0.1:8082`. Community used Gemini 2.5 Pro + GPT-4o-mini pairing. — [[2025-07-02-实现claude-code自由-一键部署的docker化claude-code-]]
