---
created: 2026-04-20
updated: 2026-04-20
type: topic
source_count: 2
---

# Kernel Authoring Languages

The lower-level programming surface kernel engineers use when stock framework backends leave performance on the table. Each major accelerator family ships its own DSL — they sit *below* the graph compiler ([[PyTorch]] Inductor, XLA) and *above* raw assembly. This is where the gap between "stock PyTorch MFU" and "hand-tuned MFU" gets closed.

## Current understanding

A consistent pattern across vendors:

| Vendor | Hardware | Kernel language(s) | Higher-level frontend |
|---|---|---|---|
| [[NVIDIA]] | GPU (H100/B200) | CUDA C++, Triton, CuTe-DSL | (Triton already serves both roles) |
| [[Google]] | [[TPU]] (v7) | [[Pallas]] | Helion (codegen target → Pallas) |
| [[AWS]] | [[Trainium3]] | [[NKI]] (Neuron Kernel Interface) | _(none called out yet)_ |

Stock-vs-tuned MFU gap is wide on at least one vendor explicitly: on Trainium3, dense PyTorch hits ~43% BF16 MFU; hand-written NKI kernels reach ~60% (per [[2026-04-19-aws-trainium3-deep-dive]]). The TPU article ([[2026-04-20-google-tpuv7-deep-dive]]) doesn't quantify the gap but treats kernel-level work as essential — Google merging TPU-tuned attention/GEMM into [[vLLM]], plus the Inductor → Pallas codegen effort, both implicitly say "you can't ship serious TPU perf without kernel-language work."

## Open threads

- Is the convergence point a higher-level DSL above all of these (Triton-style on top of CUDA + Pallas + NKI)? Helion is one bet on that.
- For the median ML engineer (not the "elite L337" engineer per the Trainium3 article), is direct kernel authoring still the path, or does framework-level codegen (Inductor → backend) close the gap?
- Cross-vendor portability is essentially zero today — every accelerator requires a kernel rewrite. Does any of the work in this space change that, or is the kernel layer permanently vendor-bespoke?

## Sources drawn on

- [[2026-04-19-aws-trainium3-deep-dive]] — [[NKI]] as Trainium3's kernel language; ~43% → ~60% MFU lift from hand-written kernels
- [[2026-04-20-google-tpuv7-deep-dive]] — [[Pallas]] as TPU's; Helion frontend; Inductor codegen target; Google contributing kernels into [[vLLM]]
