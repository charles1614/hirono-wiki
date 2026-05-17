---
created: 2026-05-17
updated: 2026-05-17
type: entity
refs: 2
tier: seen
---

# torchcomms

PyTorch communication library with Python bindings, two pure-Python backend prototypes (nccl4py wrapper, SymmetricMemory+Triton); integrates with torch.distributed for research prototyping

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- torchcomms (#2080) added Python bindings (May 2026) plus two pure-Python backend prototypes — one wrapping NVIDIA's new nccl4py bindings (#2515) and one built on SymmetricMemory + [[OpenAI Triton]] (#2521). Both pass the core torchcomms integration test suite. Plugs into `torch.distributed` so researchers can fork, tweak, and mix backends with [[Torchtitan]] without touching C++. — [[2026-05-12-pytorch-devlog]]
