---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 10
tier: active
---

# Microsoft

Hyperscaler; Azure cloud; AI infrastructure; OpenAI partner

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Epoch.ai data center database: operates or anchors four frontier sites — Fairwater Wisconsin (#2 globally at 559k H100-eq / 555 MW / $17.7B, two-story GPU rack buildings vertically networked), Fairwater Atlanta (374k / 433 MW / $11.9B, QTS-built with Microsoft as tenant), Goodyear AZ (205k / 263 MW / $7.9B, likely for OpenAI), and Project Osmium Iowa (97k / 228 MW / $8.7B, 5-building campus including ~25k A100s used by OpenAI to train GPT-3.5). Also tenant at Sines Portugal (Nscale, 32k H100-eq, hosts Europe's first GB300 chips). — [[2026-01-22-data-on-frontier-ai-data-centers]]
- Listed as a key initial technology partner in Stargate (alongside NVIDIA, Oracle, Arm, others); Azure usage continues alongside Stargate on-premises infrastructure per OpenAI's original announcement. — [[2026-01-22-openai-s-stargate-project-a-guide-to-the]]
- Redesigned [[Azure Blob Storage]] for OpenAI's EB-scale AI training: single-purpose data centers (GPU racks + Blob Storage racks only), Scaled Storage Accounts (logically one account, physically distributed grid), and [[BlobFuse]] FUSE layer achieving 8.1 Tbps write / 13.5 Tbps read at 16,800 vCPUs; automated tiering auto-purges stale checkpoints via last-access-time policies. — [[2025-10-12-重塑ai训练数据底座-azure-blob-存储如何点燃-openai-的训练洪]]
- Relaxed [[OpenAI]] exclusivity clauses in early 2025 enabling Oracle + AWS cloud deals. Retains ~27% ownership of OpenAI post-PBC restructuring (~$135B stake). Separately leased 900 MW from Crusoe at the Abilene TX site that OpenAI declined to expand — the two companies are literal neighbors on the same tract with separate compute strategies. Participated in OpenAI's March 2026 $122B funding round. — [[2026-01-22-oracle-openai-s-300b-deal-ai-infrastruct]]
- `get.activated.win` hosts the Microsoft Activation Scripts (MAS) PowerShell launcher: downloads MAS_AIO.cmd from three mirrors (GitHub raw, Azure DevOps, self-hosted git) in random order, SHA256-verifies the payload against a pinned hash, checks for antivirus/AutoRun blockers, then runs with elevated privileges. — [[2025-07-27-get]]
- [[VS Code]] Remote SSH changed the server bootstrapping mechanism at v1.82: now requires both a `vscode-cli` binary and the server archive, placed at new paths under `~/.vscode-server/cli/servers/Stable-${COMMIT_ID}/server/`; disabling "SSH: Use Exec Server" reverts to legacy behavior. — [[2025-08-08-how-do-i-install-vscode-server-offline-o]]
