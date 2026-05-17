---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# PyTorch Symmetric Memory

PyTorch 2.9 experimental feature abstracting NVLink peer memory access for custom multi-GPU kernels

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- PyTorch Symmetric Memory (PyTorch 2.9 experimental) uses `cuMemMap`/`cuMemSetAccess` to bind remote GPU buffers into local virtual address space after a `rendezvous()` collective; one-shot all-reduce via NVLS multicast achieves ~500 GB/s effective bandwidth on 8×H100 for 1 GB tensors; Triton fused all-gather + matmul delivers 1.3–1.5× speedup on Llama-70B scale. — [[2025-11-09-pytorch-symmetric-memory-解锁-nvlink-可编程性的]]
- NCCL 2.27 symmetric memory is the NCCL-native analog of PyTorch Symmetric Memory: the same CUDA VMM mechanism (handle export → allgather → import → `cuMemMap`) creates identical virtual address layouts across all local ranks at `baseUCSymPtr + rankID * baseStride + offset`, enabling custom low-latency kernels without IPC handle overhead; inter-node symmetric memory via IBGDA is on the NCCL roadmap. — [[2025-08-14-让nccl性能起飞的nccl-symmetric-memory是啥黑科技-par]]
