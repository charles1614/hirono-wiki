---
created: 2026-05-12
updated: 2026-05-11
type: entity
refs: 1
tier: seen
---

# MLOPart

Memory Locality Optimization Partition — Blackwell feature that presents one underlying GPU as multiple memory-locality-optimized CUDA devices.

## Observations

- Blackwell-only feature (compute capability 10.0 / 10.3 — B200 and B300 today; GB200/GB300 in a future CUDA release). Presents one underlying GPU as multiple CUDA devices, each with fewer SMs and less available memory, each optimized for memory locality. Compute capability 10.0/10.3 GPUs get **two partitions**. Not to be confused with MIG — MLOPart is a memory-locality optimization, not a multi-tenant security-isolation boundary. — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]
