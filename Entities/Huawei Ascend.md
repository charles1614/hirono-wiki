---
created: 2026-05-15
updated: 2026-05-16
type: entity
refs: 4
tier: active
---

# Huawei Ascend

Huawei NPU/GPU AI accelerator; Ascend 910/920 series; domestic Chinese alternative to NVIDIA

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Epoch.ai dataset: Ascend 920 (Oct 2025) at 900 TFLOP/s FP16 / 4 TB/s BW, no FP8 or memory figure — limited disclosure consistent with export-control constraints. Ascend 910C (Oct 2024) is the most data-complete Chinese chip in the set: 800 TFLOP/s FP16 / 128 GB / 3.2 TB/s at 700 W. — [[2026-01-22-data-on-machine-learning-hardware]]
- 引望智能（原华为车BU）的Percept-WAM以InternVL2-80B为基础VLM，引入World-PV/BEV/Action token增强3D感知能力；开环测试0.36分、NAVSIM仿真90.2分属中等偏上，缺乏RL和SFT后训练是当前性能瓶颈。 — [[2025-12-26-3d感知-vla-华为最新wam智能驾驶模型分析]]
- 华为Ascend NPU配套profiling工具Insight提供Python/CANN/AscendHardware/Communication/OverlapAnalysis/AI core Freq/HBM/LLC/QoS等多维时序图；以DeepSeek V3（MoE+MLA）为例，可观测集群通信从Python层下发到AscendHardware执行的时间滞后，以及双流micro batch运算的重叠度变化；NPU profiling中SDMA、AIV等指标含义需了解Ascend架构模块。 — [[2025-09-10-gpu-npu推理profiling阅读引导-下]]
