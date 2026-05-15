---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 4
tier: active
---

# NVLink

NVIDIA's high-bandwidth GPU-to-GPU interconnect; current gen (NVLink 5) ~1.8 TB/s; defines the NVLink domain for inference disaggregation.

## Synthesis

*Regenerated from Observations below.*

## Observations

- NVLink-C2C variant connects [[Vera CPU]] to [[Rubin]] GPU at 1.8 TB/s coherent bandwidth — 7× PCIe Gen 6; enables CPU-GPU cache coherence within the Vera Rubin NVL72 platform, removing PCIe as the CPU-side orchestration bottleneck for agentic AI workloads. — [[2026-03-17-nvidia-launches-vera-cpu-purpose-built-f]]
