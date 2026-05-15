---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 9
tier: active
---

# NVLink

NVIDIA's high-bandwidth GPU-to-GPU interconnect; current gen (NVLink 5) ~1.8 TB/s; defines the NVLink domain for inference disaggregation.

## Synthesis

*Regenerated from Observations below.*

## Observations

- NVLink-C2C variant connects [[Vera CPU]] to [[Rubin]] GPU at 1.8 TB/s coherent bandwidth — 7× PCIe Gen 6; enables CPU-GPU cache coherence within the Vera Rubin NVL72 platform, removing PCIe as the CPU-side orchestration bottleneck for agentic AI workloads. — [[2026-03-17-nvidia-launches-vera-cpu-purpose-built-f]]
- Vera Rubin NVL72 ships NVLink 6 switches providing 3.6 TB/s all-to-all scale-up bandwidth per GPU; full rack delivers 260 TB/s NVLink bandwidth; NVLink-C2C provides 1.8 TB/s coherent CPU-GPU bandwidth within the [[Rubin]] Superchip (2 GPUs + 1 Vera CPU per Superchip = 100 PFLOPS NVFP4 + 576 GB HBM4). — [[2026-01-26-nvidia-vera-rubin-nvl72-co-designed-infr]]
- In GB200 weight offloading v2: NVLink-C2C CPU-GPU interconnect minimizes weight onload latency vs. PCIe, making async prefetch of offloaded weights viable with near-zero throughput loss; enables prefill of DeepSeek-R1 with every other MoE GEMM weight offloaded to CPU while maintaining full compute saturation. — [[2026-02-05-在-blackwell-上推动-vllm-wide-ep-与大规模推理走向成熟-]]
