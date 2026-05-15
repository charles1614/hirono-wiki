---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 5
tier: active
---

# Amazon Trainium

AWS custom ML accelerator; Trainium2/3 generations for training and inference

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Epoch.ai dataset: Trainium3 (Dec 2025) at 671 TFLOP/s FP16 / 2.52 PFLOP/s FP8 / 700 W — memory and bandwidth not disclosed, making efficiency comparisons incomplete. Trainium2 (Dec 2024) more transparent: 667 TFLOP/s FP16 / 1.3 PFLOP/s FP8 / 96 GB / 2.9 TB/s at 500 W. — [[2026-01-22-data-on-machine-learning-hardware]]
- Trainium3 ships on TSMC N3P with 144 GB HBM3E at 9.6 Gbps (4 stacks, Hynix/Micron), 1.2 TB/s uni-directional scale-up bandwidth via PCIe 6.0 NeuronLinkv4. Two rack SKUs: NL32x2 Switched (air-cooled, 64 chips/2-rack, majority of 2026 volume) and NL72x2 Switched (liquid-cooled, 144 chips/2-rack, GB200 NVL72 analogue). Switched fabric replaces Trn2 3D Torus; Gen1 PCIe switches → Gen2 → Gen3 UALink upgrade path during lifecycle. — [[2026-02-04-aws-trainium3-deep-dive-a-potential-chal]]
- Trainium3 microarchitecture: 8 NeuronCores per package; 2× MXFP8 vs Trn2 (same BF16); dedicated collective communication cores for contention-free compute/comms overlap; auto-forwarding across 144-chip SBUF address space; hardware tensor dereferencing for dynamic MoE routing. Exponential unit 4× faster per cycle. Day 0 MFU: 43% BF16 (dense), 20–30% BF16 (MoE) via torch.compile; ~60% / ~40% with hand-crafted NKI kernels. — [[2026-02-04-aws-trainium3-deep-dive-a-potential-chal]]
- Logical NeuronCore (LNC) limitation: Day 0 only LNC=1/LNC=2 (36 GB logical device); LNC=8 (full 144 GB) not until mid-2026 — a blocker for ML research scientists outside Anthropic/Bedrock who expect H100-equivalent single-device headroom. — [[2026-02-04-aws-trainium3-deep-dive-a-potential-chal]]
- Software strategy pivot: Phase 1 open-sources native PyTorch backend (PrivateUse1 eager + torch.compile), NKI kernel/comm libraries; Phase 2 open-sources XLA/JAX. Also adopts NVIDIA NIXL KV cache transfer library to enable cross-vendor disaggregated serving (e.g. B200 prefill → Trn3 decode). — [[2026-02-04-aws-trainium3-deep-dive-a-potential-chal]]
- Trainium4 planned in two tracks: UALink 224G and NVLink 448G BiDi fusion; NVLink track can extend coherent domains to 144+ chips via cross-rack AECs (vs fixed-72 on VR NVL144). Alchip leads back-end design for both. — [[2026-02-04-aws-trainium3-deep-dive-a-potential-chal]]
