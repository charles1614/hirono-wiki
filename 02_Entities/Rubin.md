---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 9
tier: active
---

# Rubin

NVIDIA GPU architecture successor to Blackwell, paired with Vera CPU in Vera Rubin NVL72 platform

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Paired with [[Vera CPU]] in the Vera Rubin NVL72 platform; connected via NVLink-C2C at 1.8 TB/s coherent bandwidth (7× PCIe Gen 6), enabling GPU-CPU data sharing without PCIe bottlenecks. Also available as HGX Rubin NVL8 with Vera as host CPU. — [[2026-03-17-nvidia-launches-vera-cpu-purpose-built-f]]
- Vera Rubin NVL72 per-GPU specs: 50 PFLOPS NVFP4 inference, 35 PFLOPS NVFP4 training, 17.5 PFLOPS FP8/FP6 training, 4 PFLOPS FP16/BF16, 288 GB HBM4 at 22 TB/s, 3.6 TB/s NVLink 6 bandwidth; full rack (72 GPUs + 36 Vera CPUs): 3,600 PFLOPS NVFP4 inference, 20.7 TB HBM4, 1,580 TB/s HBM4 bandwidth. Claims 1/4 the GPUs for MoE training and 1/10 cost per token for agentic inference vs. Blackwell NVL72. — [[2026-01-26-nvidia-vera-rubin-nvl72-co-designed-infr]]
- Slated to power the first new GW of [[Stargate]] capacity coming online H2 2026, succeeding current GB200 NVL72 racks as the primary AI training hardware for new Stargate sites. — [[2026-01-22-openai-s-stargate-project-a-guide-to-the]]
