---
created: 2026-05-12
updated: 2026-05-12
type: source
source_url: https://walkinglabs.github.io/learn-harness-engineering/en/
tags: [tooling, evaluation]
---

# [2026-04-29] Learn Harness Engineering — landing page

## TL;DR

Landing page for a self-paced course on **harness engineering for AI coding agents** — the practice of wrapping models like Codex / Claude Code with explicit rules, state management, and verification loops so that "the agent gets work done reliably" rather than "the model is smart enough." The course bundles theory (why capable agents still fail), hands-on projects (baseline vs minimal-harness comparison), and a copy-ready template library (`AGENTS.md`, `feature_list.json`, `claude-progress.md`). Cited industry references: OpenAI's "harness engineering" Codex post, Anthropic's two pieces on effective long-running-agent harnesses, and the `awesome-harness-engineering` GitHub list.

## Key claims

**A harness is a closed-loop system, not a smarter model.** The course's core framing — "a harness doesn't make the model smarter; it establishes a working system around the model." Five capabilities the course teaches: constrain agent behavior with explicit rules, maintain context across multi-session tasks, stop agents from declaring victory too early, verify work via full-pipeline tests + self-reflection, make runtime observable.

**Three-track curriculum**: Lectures (theory — why agents fail despite strong models), Projects (baseline vs minimal-harness compared on real tasks), Resource Library (`AGENTS.md` / `feature_list.json` / `claude-progress.md` templates, intended to be lifted into the operator's own repos).

**Industry-anchored, not academic.** The four cited references are all engineering-blog-grade: OpenAI's Codex post on agent-first engineering, Anthropic's two pieces (effective harnesses for long-running agents; harness design for long-running app dev), and `walkinglabs/awesome-harness-engineering`. The implicit framing: harness engineering is a practitioner-driven sub-discipline, not yet papers-in-NeurIPS, and the course tries to be the first systematic synthesis.

## Visual observations

*No load-bearing images — source has no images.*

Index/landing page only; no charts, screenshots, or technical diagrams in this entry. Page is a curriculum table-of-contents with internal links to lectures, projects, and templates. The "core mechanism of a harness" subsection promises a workflow diagram in-text but only the heading rendered in this snapshot (the diagram lives one level deeper, in a specific lecture).

## What this changes

This is a stub-style landing entry; the substantive content lives one level deeper in `/lectures/*` and `/projects/*` URLs. The wiki's interest is in the *category* the course names — "harness engineering" as a distinct discipline from prompt engineering / context engineering / agent design — and the canonical reference list it curates. When/if the OpenAI and Anthropic source posts are bookmarked separately, they should cross-reference this index. For now, this Source is a pointer; deeper claims would need the per-lecture pages re-fetched and ingested.

## Raw source

> Site: walkinglabs.github.io · MIT-licensed open course
> Companion repo: <https://github.com/walkinglabs/awesome-harness-engineering>
> Cited references (linked from page body):
> - OpenAI: <https://openai.com/index/harness-engineering/>
> - Anthropic: <https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents>
> - Anthropic: <https://www.anthropic.com/engineering/harness-design-long-running-apps>
