---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://stackoverflow.com/questions/77068802/how-do-i-install-vscode-server-offline-on-a-server-for-vs-code-version-1-82-0-or
tags: [tooling, production-deployment]
---

# [2023-09-08] How to install VS Code Server offline for VS Code 1.82.0+

## TL;DR

Starting with VS Code 1.82, the Remote SSH extension expects both a `vscode-cli` binary (renamed `code-${COMMIT_ID}`) and the `vscode-server` archive extracted into a new directory path. The correct two-step offline install is: (1) place the CLI tar as `~/.vscode-server/code-${COMMIT_ID}`, and (2) extract the server tar into `~/.vscode-server/cli/servers/Stable-${COMMIT_ID}/server/`.

## Key claims

- Prior to 1.82 the server extracted to `.vscode-server/bin/<commit-id>`; from 1.82 onward the destination is `.vscode-server/cli/servers/Stable-<commit-id>/server/`.
- The bootstrapping process waits for both `vscode-cli-${COMMIT}.tar.gz.done` (the renamed CLI binary) and `vscode-server.tar.gz` to exist before proceeding; supplying only the server tar no longer suffices.
- An alternative workaround is to disable "SSH: Use Exec Server" (`Settings > SSH: Use Exec Server > Off`), which reverts to the old bootstrapping mode and allows the pre-1.82 single-tar method.
- Verified as of VS Code 1.109.5 (Feb 2026); a community-contributed install script automates both extractions: `tar -xzf vscode_cli_alpine_x64_cli.tar.gz && mv code code-${COMMIT_ID}` followed by `tar xzf vscode-server-linux-x64.tar.gz --strip-components=1 -C ~/.vscode-server/cli/servers/Stable-${COMMIT_ID}/server/`.
- GLIBC_2.27 is a minimum dependency for the server binary; older RHEL/Oracle Linux systems may fail with library version errors.

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## Entities touched

[[VS Code]], [[Microsoft]]

## Topics touched

[[Training Infrastructure]]

## Raw source

[stackoverflow.com/questions/77068802](https://stackoverflow.com/questions/77068802/how-do-i-install-vscode-server-offline-on-a-server-for-vs-code-version-1-82-0-or) — Stack Overflow Q&A, 8 answers, Sep 2023–Feb 2026. Read 2026-05-15.
