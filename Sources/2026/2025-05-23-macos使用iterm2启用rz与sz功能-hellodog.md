---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://wsgzao.github.io/post/lrzsz
tags: [tooling, production-deployment]
---

# [2024-10-03] macOS使用iTerm2启用rz与sz功能

## TL;DR

Setup guide for enabling ZMODEM file transfer (`rz`/`sz`) on macOS via iTerm2 Triggers and the `lrzsz` Homebrew package, including Apple Silicon (M-chip) path changes and two helper shell scripts.

## Key claims

- Install lrzsz via `brew install lrzsz`; on Apple Silicon the binary lands at `/opt/homebrew/Cellar/lrzsz/0.12.20_1/` — requires manual symlinks `ln -s /opt/homebrew/.../rz /usr/local/bin/rz` (Intel path `/usr/local/Cellar/` differs).
- iTerm2 Triggers config requires two entries: regex `rz waiting to receive.**B0100` → `Run Silent Coprocess /usr/local/bin/iterm2-send-zmodem.sh`; regex `**B00000000000000` → `Run Silent Coprocess /usr/local/bin/iterm2-recv-zmodem.sh`.
- Two helper scripts (`iterm2-send-zmodem.sh`, `iterm2-recv-zmodem.sh`) from the RobberPhex GitHub repo use AppleScript to open a macOS file picker dialog.
- `rz` = server receives (client uploads); `sz filename` = server sends (client downloads); `rz -be` is recommended for binary-safe uploads.
- Limitations: only suitable for small files; cannot transfer directories; requires ZModem protocol support (PuTTY does not support it).

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## Raw source

[wsgzao.github.io/post/lrzsz](https://wsgzao.github.io/post/lrzsz) — blog post by wsgzao (HelloDog), updated 2024-10-03. Read 2026-05-16.
