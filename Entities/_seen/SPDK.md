---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 1
tier: seen
---

# SPDK

Storage Performance Development Kit — Intel's open-source user-space storage software framework for high-performance NVMe/NVMe-oF workloads

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- [[SPDK]] v24.05 introduced chained acceleration operations API (`spdk_accel_append_*` / `spdk_accel_sequence_finish`) allowing multi-step IO transforms (DMA + encrypt + CRC) to be submitted as a single hardware request to IPU LCE, eliminating separate accelerator calls and buffer roundtrips. Complementary optimizations: deferred buffer allocation (fake-buffer placeholder for reads) and early buffer free (release after data submission, not end-to-end completion). Both optimizations are in open-source core — validated on Intel IPU LCE hardware. — [[2025-05-26-intel-spdk加速框架演进]]
