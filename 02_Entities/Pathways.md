---
created: 2026-05-11
updated: 2026-05-16
type: entity
refs: 9
tier: active
---

# Pathways

Google's distributed ML runtime; lets one program span tens of thousands of TPU chips; powers Gemini.

## Synthesis

*Regenerated from Observations below.*

## Observations

- Originally announced (2021) as a next-generation AI architecture targeting multi-task, multi-modal, sparsely-activated models — the public design vision predating its realization as a distributed TPU runtime powering Gemini. — [[2026-01-12-introducing-pathways-a-next-generation-a]]
- Pathways (MLSys 2022) introduced single-controller vs. multi-controller framing: single-controller uses a master Python process managing thousands of TPU devices (later adopted by [[verl]] for RL training graphs); multi-controller (SPMD/MPI-style) is appropriate for DP but cannot handle MPMD workloads without deadlock risk. The paper was authored under Yonghui Wu (now ByteDance Seed lead) and trained 540B PaLM. Oneflow team's public commentary remains the most cited deep analysis of the paper's design choices. — [[2025-05-30-https-zhuanlan-zhihu-com-p-1911558458903]]
