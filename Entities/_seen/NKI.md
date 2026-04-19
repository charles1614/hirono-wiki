---
created: 2026-04-19
updated: 2026-04-19
type: entity
refs: 1
tier: seen
---

# NKI

Neuron Kernel Interface. [[AWS]]'s kernel authoring language for [[Trainium3]]. Analogous in role to CUDA C++ / Triton for NVIDIA GPUs.

## Synthesis

Hand-written NKI kernels unlock significant MFU headroom over stock backends (~60% vs 43% on dense; 40% vs 20–30% on MoE). The open-source move (compiler + libraries) is the test of whether NKI can reach a non-elite audience.

## Observations

- Hand-crafted NKI kernels lift dense BF16 MFU from 43% (stock PyTorch) to ~60% on Trainium3. — [[2026-04-19-aws-trainium3-deep-dive]]
- AWS is open-sourcing the NKI compiler plus NKI kernel + communication libraries (their analogues of NCCL / cuBLAS / cuDNN / ATen ops). — [[2026-04-19-aws-trainium3-deep-dive]]
