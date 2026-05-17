---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://intuitionlabs.ai/articles/openai-stargate-datacenter-details
tags: [training, gpu, accelerator-design, production-deployment, announcement]
---

# [2026-01-22] OpenAI's Stargate Project: A Guide to the AI Infrastructure

## TL;DR

IntuitionLabs guide (revised February 2026) to the [[Stargate]] project's datacenter geography, build-out timeline, and hardware stack. Distinct from the companion Oracle deal analysis: this source maps the *site-by-site rollout* — Abilene TX flagship (1.2 GW, 450k GB200 GPUs), six follow-on U.S. campuses, and four international "OpenAI for Countries" deployments (UAE, Norway, UK, Argentina) — and introduces the sub-project framing: [[Rubin]]-generation hardware for H2 2026, [[OpenAI]]'s custom "Titan" inference chip with [[Broadcom]] on TSMC 3nm, and the 10 GW / $500B total capacity target the JV is tracking ahead of schedule.

## Key claims

- **Stargate JV structure**: [[OpenAI]] + [[SoftBank]] + [[Oracle]] + Abu Dhabi's MGX; $100B initial, ramping to $500B over four years. SoftBank (Masayoshi Son as chairman) handles financing; OpenAI manages operations. SoftBank completed its $41B investment in OpenAI in December 2025, securing ~11% stake. Announced at the White House on January 21, 2025.
- **Abilene TX flagship**: Oracle-overseeing; Crusoe Energy land. 10 buildings × ~500k sq ft; Oracle deploying 450k GB200 GPUs under a 15-year lease, costing ~$40B. 1.2 GW total when complete. First two buildings operational September 2025 ("up and running"); remaining six by mid-2026. 6,400+ construction workers by late 2025; permanent jobs controversial — Bloomberg cited ~57 ongoing positions per facility.
- **U.S. site expansion to ~8+ GW**: five additional campuses announced September 2025 — three Oracle-led (Shackelford County TX ~1.4 GW, Doña Ana County NM, Midwest TBD; combined Oracle ~5.5 GW) and two SoftBank-led (Lordstown OH, Milam County TX; combined ~1.5 GW / 18 months). Stargate Michigan added October 2025: 1 GW / $7B / 250 acres in Saline Township, dubbed "The Barn." January 2026: OpenAI + SoftBank each invest $500M in SB Energy to operate the 1.2 GW Milam County campus.
- **International "OpenAI for Countries"**: UAE (May 2025, 1 GW JV with G42/Oracle/NVIDIA/Cisco/SoftBank; 200 MW by 2026); Norway (July 2025, Narvik, 230 MW + 290 MW expansion, hydropower, liquid cooling, waste heat reuse, with Nscale and Aker); UK (September 2025, Nscale Cobalt Park, 8k→31k GPUs for sovereign UK workloads, with NVIDIA); Argentina (October 2025, Patagonia, 500 MW / $25B with Sur Energy, first 100 MW targeted 2027). South Korea: Samsung + SK Hynix HBM supply deals; SK Telecom MoU for two Korean facilities (20 MW initial).
- **Hardware stack**: NVIDIA committed up to $100B in chip supply to Stargate; GB200 NVL racks being delivered now. AMD agreed ~6 GW of future GPU capacity (MI300-series). [[Rubin]] (Vera Rubin next-gen NVIDIA) slated to power first new GW of Stargate capacity in H2 2026. Arm (SoftBank subsidiary) provides CPU designs in next-gen NVIDIA chips.
- **"Titan" custom chip**: OpenAI co-developing first in-house AI inference processor with [[Broadcom]], codenamed "Titan," on TSMC 3nm. Team led by Richard Ho, ~40 engineers. Mass production targeted H2 2026 for "o1"-series inference. 10 GW of Broadcom-based AI hardware by 2029 — reduces long-term NVIDIA dependency. (Complements the [[2026-01-22-oracle-openai-s-300b-deal-ai-infrastruct]] framing of same chip.)
- **Progress vs skepticism**: $400B+ of the $500B commitment "already in play" per OpenAI as of late 2025. Elon Musk publicly labeled the plan "fake" (SoftBank "well under $10B secured") in January 2025; SoftBank's December 2025 $41B close substantially refuted this. Tariffs (mid-2025) added estimated 5–15% to build costs; market volatility prompted Bloomberg reports of slow start. By February 2026 two Abilene buildings are operational, permitting multiple campuses underway.
- **Power and sustainability**: 10 GW total target ≈ enough for 7.5 million homes. Norway and UAE explicitly run on renewables; cooling uses closed-loop liquid. SB Energy and local utilities accelerating power infrastructure. Energy and water demand is a noted community concern; data centers consume ~2% of U.S. electricity.
- **Economic framing**: OpenAI frames Stargate as the "compute equivalent of the Interstate Highway" — 100k–200k U.S. construction + operations jobs claimed; independent sources caution most are temporary construction roles.

## Visual observations

*No load-bearing images — source has no images* (the header is a decorative banner; no charts, diagrams, or data figures).

## Entities touched

[[Stargate]], [[OpenAI]], [[Oracle]], [[SoftBank]], [[Microsoft]], [[NVIDIA]], [[Broadcom]], [[Rubin]], [[AMD]], [[CoreWeave]]

## Topics touched

[[AI Data Centers]]

## Raw source

[intuitionlabs.ai/articles/openai-stargate-datacenter-details](https://intuitionlabs.ai/articles/openai-stargate-datacenter-details) — IntuitionLabs guide, revised February 21, 2026. Originally published January 22, 2026. ~44 KB markdown.
