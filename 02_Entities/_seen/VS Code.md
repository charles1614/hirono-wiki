---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# VS Code

Microsoft's extensible code editor with Remote SSH extension supporting offline server installation

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- From v1.82 onward, offline Remote SSH installation requires two artifacts: the `vscode-cli` binary renamed to `code-${COMMIT_ID}` in `~/.vscode-server/`, and the server tar extracted to `~/.vscode-server/cli/servers/Stable-${COMMIT_ID}/server/` (prior path was `~/.vscode-server/bin/${COMMIT_ID}`). Disabling "SSH: Use Exec Server" reverts to the legacy single-tar method. Verified up to VS Code 1.109.5. — [[2025-08-08-how-do-i-install-vscode-server-offline-o]]
