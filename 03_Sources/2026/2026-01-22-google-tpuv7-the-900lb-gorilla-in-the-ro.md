---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://newsletter.semianalysis.com/p/tpuv7-google-takes-a-swing-at-the
tags: [inference, training, accelerator-design, tpu, announcement]
---

# [2026-01-22] Google TPUv7: The 900lb Gorilla In the Room

## TL;DR

SemiAnalysis (Dylan Patel et al.) — comprehensive analysis of Google's TPUv7 [[Ironwood]] externalization strategy, covering the [[Anthropic]] 1M-TPU deal ($52B split between direct 400k unit sale and 600k GCP rental), chip microarchitecture vs [[Blackwell]], system/ICI network architecture, and a critical assessment of Google's software ecosystem shifts. Core thesis: Ironwood's ~44% lower all-in TCO vs GB200 (from Google's procurement cost perspective), combined with higher realized MFU potential, makes TPU the first credible merchant-silicon threat to [[NVIDIA]]'s dominance — if Google opens the XLA/runtime software stack.

## Key claims

- **The Anthropic deal structure**: 400k TPUv7 Ironwoods sold directly by [[Broadcom]] to Anthropic (~$10B in finished racks); 600k TPUs rented via GCP (estimated $42B RPO, accounting for most of GCP's $49B backlog increase in Q3). Fluidstack handles on-site setup; TeraWulf and Cipher Mining supply DC infrastructure.
- **TCO advantage from Google's perspective**: all-in Ironwood TCO is ~44% lower than a GB200 server — despite Broadcom's margin on the silicon. From Anthropic's GCP rental perspective (incorporating Google's margin), the advantage narrows to ~30% lower than GB200 and ~41% lower than GB300 per TPU-hour at $1.60/hr.
- **Effective MFU argument reverses the FLOPs spec gap**: Ironwood trails GB200 ~10% on peak FLOPs and ~10% on peak memory bandwidth. But Nvidia's marketed FLOPs are inflated — GB200 in practice lands in the 70s% of peak due to DVFS and power limits, while TPU FLOPs are conservatively rated. SemiAnalysis estimates Anthropic can reach 40% MFU on TPUs, yielding ~52% lower TCO per effective PFLOP vs GB300 NVL72. The breakeven MFU where Anthropic's rented TPU cost equals GB300 at 30% MFU is just 19% extracted MFU.
- **Ironwood vs Blackwell spec delta** (at chip level): Ironwood FLOPs and memory bandwidth trail GB200 slightly; HBM capacity is same 8-Hi HBM3E = 192 GB (significant shortfall vs GB300 at 288 GB 12-Hi HBM3E). GA ~1 year after Blackwell.
- **Trillium → Ironwood transition**: Trillium (v6e, TPUv6) used 2× HBM3 stacks only — weak on memory relative to H100/H200. Ironwood closes this with 8-Hi HBM3E. Trillium's 256×256 systolic array (4× larger than v5p's 128×128) is what drove the 2× FLOPs jump on same N5 node.
- **ICI 3D torus architecture**: each 64-TPU rack forms a 4×4×4 3D torus using copper for interior connections and 800G optical transceivers + Optical Circuit Switches (OCS) for cube faces and inter-cube links. Maximum world size 9,216 TPUs (144 cubes); today's supported configurations range 4 to 2,048 TPUs. OCS enables topology reconfiguration (thousands of slice shapes), fault routing, and full cube fungibility — any "+" face of any cube can connect to any "−" face.
- **DCN extends to 147k TPUs**: a separate Datacenter Network with DCNI-layer OCS (hypothesized 300×300, 256 switches in 32 racks) connects 16 ICI pods / 4 aggregation blocks at 147,456 TPUs without oversubscription.
- **Software strategy shift — two major moves**: (1) native PyTorch TPU backend (RFC #9684, announced by "Captain Awesome" Robert Hundt) replacing lazy XLA tensor capture — supports eager execution, torch.compile, DTensor, FSDP2, torch.distributed; motivated by Meta's renewed TPU interest. (2) vLLM/SGLang TPU support (beta) via TorchAX — lowering PyTorch model code to JAX for compilation; currently limited model support, no multi-host wide-EP disagg prefill, no MTP.
- **All-fused MoE kernel**: Google's vLLM TPU implementation avoids sorting by expert ID (TPUs are slow at sorting); dispatches tokens for one expert per device at a time while overlapping MoE dispatch/combine communication. Reported 3–4× speedup over existing kernel.
- **SparseCore for MoE**: SCT supports 4-byte/32-byte granularity gather/scatter and ICI communications overlapped with TensorCore operations — when Mosaic programmability matures, MoE dispatch/combine on TPU will match GPU patterns without pre-shuffle workarounds.
- **Critical missing piece**: XLA graph compiler, networking libraries, TPU runtime, and MegaScale (multi-pod training) codebase remain closed-source. SemiAnalysis argues open-sourcing XLA:TPU would accelerate adoption faster than the software IP cost — analogous to PyTorch or Linux.
- **Neocloud market impact**: Google/Fluidstack/TeraWulf deal introduced the "hyperscaler backstop" model — off-balance-sheet IOU solving the duration mismatch (4–5 year GPU useful life vs 15+ year DC lease). Expected to become the de-facto financing template. Jensen-invested Neoclouds (CoreWeave, Nebius, Crusoe, Lambda, etc.) are structurally incentivized against adopting TPU.
- **OpenAI's TPU leverage without deploying one**: competitive threat alone drove ~30% discount on OpenAI's entire NVIDIA fleet — "perf per TCO advantage so strong you get gains even before turning one on."

## Visual observations

**Fig — TPU FLOPs trajectory vs Nvidia flagships** (`../../raw/raindrop/newsletter.semianalysis.com/2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro/substack-img-012.png`)

![Bar chart showing TPU v4/v5 well below Nvidia flagships on peak FLOP/s, with TPUv6 Trillium nearly closing the gap to H100, and TPUv7 Ironwood nearly matching GB200 — gap narrows each generation](https://hirono-wiki.litenext.digital/raindrop/newsletter.semianalysis.com/2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro/substack-img-012.png)

Crystallizes the generational catch-up: TPU silicon conservatism through v5, then a clear design-philosophy shift at v6/v7 co-designed for LLM workloads. Direct evidence for the "microarchitecture gap nearly closed" claim.

**Fig — Ironwood vs GB200/GB300 TCO comparison** (`../../raw/raindrop/newsletter.semianalysis.com/2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro/substack-img-016.png`)

![TCO waterfall chart showing all-in Ironwood cost ~44% lower than GB200 from Google's procurement perspective, with callouts for Broadcom margin, system BOM components](https://hirono-wiki.litenext.digital/raindrop/newsletter.semianalysis.com/2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro/substack-img-016.png)

Load-bearing: this is the economic thesis of the entire piece. The ~44% figure anchors every downstream Anthropic pricing and MFU breakeven calculation.

**Fig — Anthropic GCP-rented TCO vs GB300** (`../../raw/raindrop/newsletter.semianalysis.com/2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro/substack-img-020.png`)

![MFU breakeven chart for Anthropic GCP rental; shows 19% extracted MFU as the breakeven point against GB300 at 30% MFU, with 40% MFU scenario yielding ~52% lower cost per effective PFLOP](https://hirono-wiki.litenext.digital/raindrop/newsletter.semianalysis.com/2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro/substack-img-020.png)

The key operator decision chart — quantifies how much MFU headroom Anthropic has before TPU economics invert.

- **ICI 4×4×4 cube topology diagrams** (substack-img-031 through -044): architectural schematics of the 3D torus rack, optical transceiver placement per cube position, OCS face-to-face connection mechanics, scale-up to 9,216-chip cluster. Supporting — the topology is described fully in text; diagrams are verification material.
- **vLLM contribution activity chart** (substack-img-049): GitHub commit frequency by quarter showing the May spike for tpu-inference repo creation. Supporting — corroborates the "software externalization" timeline narrative.
- **Spec comparison tables** (substack-img-014, -015): Trillium vs H100/H200 memory shortfall, Ironwood vs GB200/GB300 chip spec delta. Supporting — numbers extracted into Key Claims above.
- *Other images decorative — article header art, prior-report previews, stock-price charts, benchmark screenshots for unrelated NVIDIA/AMD comparisons.*

## What this changes

- **Puts concrete numbers on the TPU economic thesis**: the "systems matter more than microarchitecture" claim now has a cited TCO figure (~44% lower) and a specific MFU crossover point (19% vs 30%). Previous Sources had architecture arguments; this Source adds the financial model.
- **Establishes the externalization shift as real**: Anthropic 1M-TPU deal + 00_Meta/SSI/xAI pipeline signals that Google's TPU is now a merchant-silicon competitor, not just a Google-internal platform.
- **Identifies PyTorch native backend as the key software unlock**: the RFC #9684 move to native TPU dispatch is the lever that could open TPU to the majority of ML researchers currently locked in to CUDA/PyTorch. Timing and completeness remain unresolved.
- **Flags the open-source gap as the primary remaining moat risk**: Google's closed XLA:TPU compiler and MegaScale runtime are the barriers named in this Source — not silicon, not TCO.

## Entities touched

[[Google]], [[TPU]], [[Ironwood]], [[NVIDIA]], [[Blackwell]], [[Anthropic]], [[Broadcom]]

## Topics touched

[[AI Accelerators]], [[Accelerator Economics]]

## Raw source

[newsletter.semianalysis.com/p/tpuv7-google-takes-a-swing-at-the](https://newsletter.semianalysis.com/p/tpuv7-google-takes-a-swing-at-the) — SemiAnalysis newsletter · Dylan Patel et al. · Jan 22, 2026 · partial paywall (Nvidia competitive analysis + TPU roadmap behind paywall). Read 2026-05-15.
