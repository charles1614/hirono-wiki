---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# Starship

Cross-shell prompt written in Rust; configurable via TOML; shell-agnostic

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Conditional hostname display based on environment variable presence (`detect_env_vars = ['!ZELLIJ']`) requires only three TOML config lines; equivalent feature in powerlevel10k requires a custom prompt segment in zsh. — [[2026-02-10-moving-from-powerlevel10k-to-starship-fo]]
- Measured `starship timings` on WSL2: git_status at 8 ms, all other modules under 1 ms; author describes latency as imperceptible in daily use. — [[2026-02-10-moving-from-powerlevel10k-to-starship-fo]]
