---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://github.com/ox01024/cmirror
tags: [tooling]
---

# [2025-12-14] Cmirror — Rust CLI for One-Click Package Mirror Switching (China)

## TL;DR

Cmirror is a cross-platform Rust CLI tool that concurrently benchmarks mirror sources via HTTP HEAD requests (measuring TTFB), then auto-applies the fastest mirror for 9 package managers including pip, npm, conda, Docker, apt, cargo, Go, Homebrew, and uv. Designed for mainland China developers facing slow official package downloads.

## Key claims

- Written in Rust; supports pip, uv, conda, npm, docker, apt (Ubuntu/Debian), cargo, go, and brew — 9 package managers in total.
- Benchmarks all available mirrors concurrently using `HEAD` requests to measure Time To First Byte (TTFB), then ranks by latency.
- Supports `--fastest` flag to automatically select and apply the fastest mirror without user interaction, enabling CI/CD and automation workflows.
- Forces automatic backup of any config file before modification; `cmirror restore <tool>` rolls back to the most recent `.bak` backup.
- `cmirror status` shows current source URL and status across all supported tools in a single table view.
- Example benchmark result: Aliyun pip mirror measured at 25ms vs 900ms for official PyPI, a 36× improvement.
- Docker and apt modifications require sudo; go and brew mirror switching uses environment variables rather than config file edits.
- Roadmap includes yum/dnf (CentOS/Fedora) support and a TUI interactive interface via Dialoguer.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[PyTorch]]

## Topics touched

## Raw source

[github.com/ox01024/cmirror](https://github.com/ox01024/cmirror) — GitHub README (Rust project); date from slug. Read 2026-05-15.
