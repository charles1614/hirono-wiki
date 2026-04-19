---
created: 2026-04-20T00:00:00.000Z
updated: '2026-04-19'
type: topic
source_count: 2
---

# LLM-as-laborer pattern

Filed from a query-loop synthesis on 2026-04-20. The question: **what patterns connect [[Karpathy]]'s LLM-wiki method and [[Anthropic]] teams' [[Claude Code]] usage?** They cover completely different domains — knowledge management vs. coding — but the labor-division and workflow patterns are nearly identical. That's the signal worth capturing.

## Current understanding

### Shared labor split

Both framings put the LLM in the *laborer* seat and the human in the *curator* seat:

- [[Karpathy]] (from [[2026-04-19-karpathy-llm-wiki-gist]]): "[[Obsidian]] is the IDE; the LLM is the programmer; the wiki is the codebase." The human sources, explores, and asks questions. The LLM writes, summarizes, cross-links, and maintains.
- Anthropic teams (from [[2026-04-20-anthropic-teams-use-claude-code]]): the agent writes the code; the human reviews, checkpoints, and decides what's worth keeping. Across 10 teams — engineering *and* non-engineering (legal, marketing, design) — the pattern holds.

The substrate differs (markdown files vs. source trees), but the *thing the LLM does* is the same: the bulk of the toil (bookkeeping, cross-referencing, rewriting, linking) that humans find too tedious to sustain.

### Shared workflow patterns

Three specific patterns surface in both sources:

1. **Plan-then-build as a two-step.** Anthropic teams split [[Claude.ai]] (planning) from [[Claude Code]] (building). Karpathy's wiki ingestion is analogous: "discusses key takeaways with you" *first*, then writes pages. The planning surface is separated from the implementation surface, on purpose.

2. **Checkpoint-heavy commit discipline.** The Claude Code survey's most-cited tip is "start from a clean git state and commit checkpoints regularly so you can revert if Claude goes off track." Karpathy explicitly: "The wiki is just a git repo of markdown files. You get version history, branching, and collaboration for free." Both treat git as the safety rail that makes the LLM's autonomy *tolerable* — rollback is cheap, so you can let the agent run.

3. **Compounding artifacts.** Karpathy: "good answers can be filed back into the wiki as new pages… explorations compound." Anthropic Data Science team: "instead of throwaway Jupyter notebooks, build permanent React dashboards that can be reused across future model evaluations." Same move, different artifact. Don't let the agent's output evaporate into chat history.

### What they don't share

- **One-shot vs. iterative.** Claude Code has a ~33% one-shot success rate on small-to-medium PRs (per RL Engineering). The wiki's ingest step has no equivalent notion of "one-shot" — ingesting is iterative by construction (summary → review → update). Code-writing tolerates slot-machine treatment in a way wiki curation doesn't.
- **Synchronicity.** Claude Code teams classify tasks as async-safe vs. sync-supervised. The wiki analog would be "can the LLM ingest unattended?" — Karpathy prefers one-at-a-time with human supervision but allows batching. The async/sync split is less sharp for knowledge work.
- **Tooling layer.** Claude Code leans on [[MCP]] servers and per-repo CLAUDE.md files. The wiki uses a `schema` doc that serves the same role (governance), but it's authored by the human, not by a protocol.

### Why this pattern generalizes

The common failure mode both systems prevent is **cost-of-maintenance growth**. Humans abandon personal wikis when cross-referencing burden exceeds the value; teams abandon code documentation for the same reason. LLM-as-laborer drives that cost toward zero, so the system stays healthy. Checkpoint discipline + compounding artifacts are what make the "trust but verify" relationship tractable — not *does the LLM get it right*, but *can I cheaply recover when it doesn't*.

## Open threads

- Would a CLAUDE.md-style per-repo memory file improve this wiki's ingest quality? The `Meta/schema` doc is close but designed for a different reader (the LLM at ingest time vs. the LLM inside Claude Code during a session).
- Custom slash commands are Security Engineering's force multiplier (50% of all custom slash commands in Anthropic's monorepo, per [[2026-04-20-anthropic-teams-use-claude-code]]). What's the wiki equivalent — would predefined "ingest an arXiv paper," "ingest a Raindrop, " "run the weekly lint" commands compose into something equally powerful?
- Karpathy doesn't include an async-supervision axis because the wiki use case tolerates per-source supervision. At 700+ sources (v1 scale), does that break down and the async/sync split become necessary?

## Sources drawn on

- [[2026-04-19-karpathy-llm-wiki-gist]] — the LLM-as-programmer / wiki-as-codebase framing; three-layer architecture; checkpoint git; compounding loop
- [[2026-04-20-anthropic-teams-use-claude-code]] — checkpoint-heavy slot-machine workflow; plan-in-Claude.ai / build-in-Claude-Code split; async vs sync task classification; concrete numbers on time savings and one-shot rates
