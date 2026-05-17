---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://bulimov.me/post/2025/05/11/powerlevel10k-to-starship/
tags: [devtools, developer-experience]
---

# [2025-05-11] Moving from powerlevel10k to Starship for my zsh prompt

## TL;DR
Alexander Bulimov switched from powerlevel10k to Starship for his zsh prompt after finding powerlevel10k's zsh code inscrutable and fragile. The key tipping point was wanting a simple hostname-visibility toggle based on an environment variable — trivially done in Starship with three config lines.

## Key claims
- Starship's TOML config (`[hostname] detect_env_vars = ['!ZELLIJ']`) achieves conditional hostname display in three lines; powerlevel10k requires writing a custom prompt segment.
- Measured `starship timings` on WSL2 shows per-module latency: `git_status` at 8 ms, all other modules under 1 ms — author considers this imperceptible.
- Shell-agnosticism is a practical benefit: switching away from zsh in the future would require no prompt changes.
- Confidence in software written in a modern compiled language (Rust) was cited as a secondary motivator alongside config readability.

## Visual observations
*No load-bearing images — prose-only personal blog post with no diagrams or charts.*

## Entities touched
[[Starship]]

## Topics touched
[[Educational LLM Tooling]]

## Raw source
[bulimov.me/2026-02-10-moving-from-powerlevel10k-to-starship-fo](https://bulimov.me/post/2025/05/11/powerlevel10k-to-starship/) — personal blog post by Alexander Bulimov. Read 2026-05-15.
