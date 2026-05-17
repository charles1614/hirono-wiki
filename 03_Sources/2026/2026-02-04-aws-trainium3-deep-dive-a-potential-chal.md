---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://newsletter.semianalysis.com/p/aws-trainium3-deep-dive-a-potential
tags: [training, inference, accelerator-design, parallelism, announcement]
---

# [2026-02-04] AWS Trainium3 Deep Dive | A Potential Challenger Approaching

## TL;DR

SemiAnalysis (Dylan Patel et al.) technical deep dive on Trainium3 (Trn3) — silicon, rack architecture, scale-up/scale-out networking, microarchitecture, software strategy, and TCO. The central claim: AWS has built a credible GB200-class challenger by prioritizing **perf per TCO and fastest time to market** over raw peak FLOPs, with two rack SKUs (air-cooled NL32x2 Switched, liquid-cooled NL72x2 Switched), a switched NeuronLinkv4 fabric replacing the Trn2 torus, and a major software pivot toward native PyTorch. Anthropic's training and inference workloads are the primary design constraint; the mass-market developer is the new secondary target.

## Key claims

- **Silicon**: Trn3 moves to TSMC N3P (from N5 on Trn2), doubles MXFP8 FLOPs, adds OCP MXFP4 at the same rate as MXFP8, and bumps HBM3E to 144 GB at 9.6 Gbps (Hynix/Micron, up from Samsung 5.7 Gbps). BF16 performance is unchanged. Package is CoWoS-R with two compute dies via organic RDL interposer; Annapurna (front-end design) + Alchip (back-end, two-tapeout "Anita"/"Mariana" split). **Marvell lost the Trn3 design socket to Alchip after poor execution on Trn2.**
- **Rack SKUs**: NL32x2 Switched (air-cooled, 64 Trn3s across 2 racks, codename "Teton3 PDS") for time-to-market; NL72x2 Switched (liquid-cooled, 144 Trn3s across 2 racks, Graviton4 co-located on compute tray, codename "Teton3 MAX") for max density. **Majority of 2026 volume will be NL32x2 Switched** due to datacenter liquid-cooling unreadiness.
- **Scale-up network**: NeuronLinkv4 via PCIe 6.0 (64 Gbps/lane), 144 active lanes + 16 redundant per chip = 1.2 TB/s uni-directional per chip (2× Trn2). Three switch generations planned: Gen1 Scorpio-X 160-lane PCIe (20 ports, multi-hop), Gen2 320-lane PCIe (true all-to-all), Gen3 72+ port UALink (lowest latency). **AWS uses Astera Labs PCIe switches with equity warrant "rebate" (~23% discount) and Credo AEC cables with similar structure.** Cross-rack AECs extend scale-up world to 144 chips.
- **Scale-up vs torus**: switched fabric outperforms 3D Torus for MoE models requiring all-to-all collectives; for dense models the difference is minimal. NL32x2 Switched sufficient for MoE models up to ~3T total parameters; NL72x2 Switched needed for 4T+.
- **Microarchitecture**: 8 NeuronCores per package, each with Tensor/Vector/Scalar/GPSIMD engines. 128×128 BF16 systolic array (same as Trn2) + 512×128 MXFP8/FP4 array (2× Trn2). Exponential unit 4× faster per cycle (vs Trn2) — directly addresses softmax bottleneck that also affected Blackwell (Nvidia 2× fix in Blackwell Ultra). Dedicated collective communication cores (dozens per package) enable true compute-communication overlap without SM contention. Auto-forwarding across 144-chip domain via shared SBUF memory map. New: traffic QoS shaping, tensor dereferencing for dynamic MoE routing, hardware-accelerated transposes.
- **LNC limitation**: Day 0 supports only LNC=1 or LNC=2 (4 logical devices per package, 36 GB each). **LNC=8 (full 144 GB as 1 logical device) not until mid-2026** — a research-scientist adoption blocker. Anthropic (primary customer) prefers LNC=1/2 for performance; broader ML community expects LNC=8 parity with H100 (80 GB) or GB300 (288 GB).
- **Software pivot**: Phase 1 — native PyTorch backend via PrivateUse1 TorchDispatch key (eager mode + torch.compile), native torch.distributed APIs, DTensor/FSDP1/FSDP2/SimpleFSDP. Day 0 MFU: 43% BF16 (dense Qwen), 20–30% BF16 (MoE). With hand-crafted NKI kernels: ~60% BF16 (dense), ~40% BF16 (sparse MoE like DeepSeek 670B). Phase 2 — open-source XLA/JAX stack. Trainium also adopts **NVIDIA's NIXL KV cache transfer library** to enable cross-chip-vendor disaggregated serving (e.g. B200 prefill → Trn3 decode).
- **Trainium4 roadmap**: two tracks — UALink 224G and NVLink 448G BiDi fusion; both led by Alchip backend. NVLink track may slip. NVLink fusion enables 144+ coherent domains via cross-rack AECs (vs fixed 72 on VR NVL144).
- **TCO framing**: AWS's "Amazon Basics GB200" approach — air-cooled NL32x2 Switched deployable in legacy non-liquid-ready datacenters, avoiding CoreWeave-style deployment delays. Cableless design philosophy (PCB over flyover cables) compresses assembly time. Redundant scale-up lanes enable hot-swap switch trays without workload drain (unlike GB200).
- **Datacenter**: Project Rainier multi-gigawatt campus build-out ongoing; a new metro-area campus scaling to 1 GW (with adjacent 1 GW site) described. Air-cooled datacenter design essentially unchanged from 2021 — deliberate fungibility/TCO choice, not delayed response.

## Visual observations

*No load-bearing images — all panels are architecture topology diagrams, rack layout schematics, and spec tables whose content is fully extracted into body text above; no chart/data-viz carrying quantitative information that resists prose expression.*

## What this changes

- **Competitive landscape**: AWS is the first vendor outside Nvidia to actually ship a switched all-to-all scale-up rack at GB200 NVL72 scale — AMD MI450X arrives ~1 year later. Jensen now faces three distinct fronts: TPUv7, MI450X, and Trainium3.
- **MoE inference scale-up**: switched fabric enables efficient expert parallelism for 2–4T+ MoE models; torus-based approaches (Trn2 NL64) are bandwidth-limited at scale for all-to-all collectives.
- **Software ecosystem moat**: native PyTorch integration (if LNC=8 ships mid-2026 and MFU continues to close) removes the primary friction for non-Anthropic users. NIXL adoption signals willingness to interoperate with Nvidia's library ecosystem — an unusual strategic choice.
- **TCO benchmark raised**: perf-per-TCO framing (not peak FLOPs) as the competitive axis is now a live three-way contest. Sources needed: actual perf-per-TCO numbers at the system level.

## Entities touched

[[Amazon Trainium]], [[AWS]], [[NVIDIA]], [[Blackwell]], [[TPU]], [[Anthropic]], [[AMD]], [[HBM]], [[NVLink]], [[vLLM]], [[PyTorch]]

## Topics touched

[[AI Accelerators]], [[Accelerator Economics]]

## Raw source

[newsletter.semianalysis.com/p/aws-trainium3-deep-dive-a-potential](https://newsletter.semianalysis.com/p/aws-trainium3-deep-dive-a-potential) — Dylan Patel et al., SemiAnalysis · ~917-line article · 93 images (rack diagrams, topology schematics, spec tables) · read 2026-05-15.
