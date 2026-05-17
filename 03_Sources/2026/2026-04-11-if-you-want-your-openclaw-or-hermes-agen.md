---
created: 2026-05-12
updated: 2026-05-12
type: source
source_url: https://x.com/garrytan/status/2042497872114090069
tags: [tooling]
---

# [2026-04-10] @garrytan announces GBrain — markdown-recall tool for coding agents

## TL;DR

A short x.com (Twitter) post by **Garry Tan** (YC president) announcing **GBrain** — an MIT-licensed open-source tool he built to give AI coding agents like **OpenClaw** and **Hermes** "perfect total recall" over a personal 10,000+ markdown-file corpus. Garry says it's his exact OpenClaw/Hermes setup. The thread has ~7 reply tweets covering questions about search method (vs `qmd`), Obsidian alternative, and Garry's preferred agent for daily use ("OpenClaw is fun and fast and walks on water but crashes; Hermes does feel more solid"). No deep technical detail in the thread — the load-bearing artifact is the GBrain repo (no link given in the surfaced thread; would need to be located separately).

## Key claims

- **GBrain is positioned as personal-corpus-recall infrastructure** for AI coding agents, specifically intended to scale to 10,000+ markdown files. The implicit problem is what we'd now call the "Agent context economy" — agents need to query a personal note-corpus efficiently rather than load it all upfront.
- **MIT-licensed open source.** Lowered bar for adoption / fork / personal customization.
- **Tan uses both OpenClaw and Hermes** in production. His informal characterization: OpenClaw is fast + crashes; Hermes is "more solid for the median user but slightly less ADHD and more autism." Not a benchmark — a vibes assessment from someone with substantial AI-coding-agent usage.
- **The 0.7 release adds Twilio chat** integration — let's the user SMS-message their personal OpenClaw setup.
- **Existing tool comparison**: thread references `qmd` (presumably an alternate markdown-recall tool) and Obsidian. Tan says he wanted "something that fit my needs instead" — implying GBrain is opinionated for his specific workflow, not a generic Obsidian alternative.
- **Tan's Obsidian critique** (from one reply): "Yeah it's good and it's a view, but just like I don't open VSCode anymore... so too do I not really edit or view my files directly anymore." The framing: agents become the primary file interface; humans-as-direct-editors is the legacy mode. Provocation worth tracking even if not actionable.

## Visual observations

*No load-bearing images — source has no images.*

## What this changes

A **signal Source** for the "agent-as-primary-file-interface" framing, attributed to a high-visibility person (Garry Tan / YC). Not a technical citation — adoption metrics or implementation depth aren't here — but worth keeping as a marker of where Y-Combinator-adjacent operators are heading. If GBrain becomes a corpus-recall reference implementation, the wiki should re-fetch the actual repo as a separate Source.

Adjacent to the harness-engineering theme from [[2026-04-29-welcome-to-learn-harness-engineering-lea]] — both treat the agent's interaction with the operator's local-file-system as the design problem.

## Raw source

> Platform: x.com · 作者: **Garry Tan (@garrytan, YC President)** · 2026-04-10
> Thread: OP + 7 reply tweets (incl. Tan's reply about OpenClaw vs Hermes characterization)
> GBrain repo: link not in the captured thread; would need separate search
> Related corpus: [[2026-04-29-welcome-to-learn-harness-engineering-lea]] (agent-tooling theme)
