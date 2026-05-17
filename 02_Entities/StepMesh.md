---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 3
tier: active
---

# StepMesh

StepFun (阶跃星辰) GPUDirect RDMA communication library for Attention-FFN disaggregated inference with bipartite communication support

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Built by 阶跃星辰 on [[BytePS]] as a GPUDirect RDMA library for AF disaggregated inference; must complete A2F + F2A round-trip in ≤273 µs per microbatch for 20 tokens/s SLA on Step-3 (61 layers, 3-stage pipeline). — [[2025-07-31-https-zhuanlan-zhihu-com-p-1934204758920]]
- Chose CPU-only IBRC over IBGDA (used by DeepEP) because 2A2F payload sizes (896 KB A2F, 1.75 MB F2A) make CPU control-plane negligible at 400 Gbps, and IBGDA's SM occupancy conflicts with compute-bound FFN. — [[2025-07-31-https-zhuanlan-zhihu-com-p-1934204758920]]
- Straggler detection: embeds nanosecond timestamps in RDMA packet metadata so Attention-side can attribute slowdowns to network, FFN CPU, FFN GPU, or Attention side without cross-node clock sync; current TPOT min–mean gap ~2 ms. — [[2025-07-31-https-zhuanlan-zhihu-com-p-1934204758920]]
