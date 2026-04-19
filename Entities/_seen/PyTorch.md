---
created: 2026-04-19
updated: 2026-04-19
type: entity
refs: 1
tier: seen
---

# PyTorch

The dominant ML framework for research and production. Graph compilation via `torch.compile` is the current standard on-ramp for new accelerator backends.

## Synthesis

Thin (1 source). Observation so far: a native PyTorch backend is now the baseline requirement for any accelerator aiming at mainstream adoption — AWS treats it as Phase 1 of its open-sourcing push.

## Observations

- AWS's Phase 1 Trainium software push centers on a native PyTorch backend + `torch.compile` graph compilation — this is the minimum-viable bridge to third-party workloads. — [[2026-04-19-aws-trainium3-deep-dive]]
