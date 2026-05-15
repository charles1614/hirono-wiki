---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 9
tier: active
---

# TPU

Google's family of ML accelerators; v2 → v3 → v4 → v5p/v5e → Trillium (v6) → Ironwood (v7).

## Synthesis

*Regenerated from Observations below.*

## Observations

- Epoch.ai dataset covers TPU v5e (Aug 2023, 197 TFLOP/s FP16, 16 GB, 819 GB/s, 225 W), v5p (Dec 2023, 459 TFLOP/s, 95 GB, 2.77 TB/s, 540 W), Trillium v6e (May 2024, 918 TFLOP/s FP8, 32 GB, 1.64 TB/s, 380 W), and Ironwood v7 (Nov 2025, 4.61 PFLOP/s FP8, 192 GB, 7.37 TB/s, 960 W) — FP8 enters the TPU lineage at v6e/Trillium, six generations after introduction. — [[2026-01-22-data-on-machine-learning-hardware]]
- Google's design philosophy was conservatively lower FLOPs than Nvidia through v5, driven by three factors: RAS (reliability/availability/serviceability) priority, RecSys-dominated internal workloads (lower arithmetic intensity), and no external marketing pressure to inflate peak specs. The LLM era triggered a design-philosophy shift visible at v6 Trillium (256×256 systolic arrays, 2× FLOPs over v5p on same N5 node) and [[Ironwood]] (v7, nearly closing FLOPs and bandwidth gap to [[Blackwell]] GB200). — [[2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro]]
- ICI 3D torus scale-up network: each 64-TPU rack forms a 4×4×4 cube; copper connections within cube interior, 800G optical transceivers + Optical Circuit Switches (OCS) for cube faces and inter-cube links; maximum world size 9,216 TPUs (144 cubes × 48 OCS). OCS enables dynamic topology reconfiguration, fault routing, and full cube fungibility — far larger scale-up domain than [[NVIDIA]]'s 72-GPU NVL72. DCN extends to 147k TPUs via a separate OCS-switched DCNI layer. — [[2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro]]
- Software externalization shift: (1) native PyTorch TPU backend (RFC #9684) replacing lazy XLA tensor capture — supports eager execution, torch.compile, DTensor, FSDP2; driven by Meta's renewed interest; (2) vLLM/SGLang TPU beta support via TorchAX; all-fused MoE kernel achieves 3–4× speedup over prior vLLM TPU kernel. Critical gap: XLA:TPU compiler, runtime, MegaScale codebase remain closed-source. — [[2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro]]
