---
created: 2026-05-15
updated: 2026-05-15
type: topic
source_count: 8
---

# AI Data Centers

## What

Large-scale physical infrastructure — campuses of GPU/TPU server buildings, power infrastructure, and cooling systems — purpose-built for frontier AI training and inference workloads. Distinguished from general-purpose cloud data centers by extreme power density (100–1,000+ MW per campus), H100-equivalent compute normalization as a standard unit, and the hyperscaler/AI-lab ownership/tenant split that increasingly defines the landscape.

## Current understanding

Epoch.ai's open database of 43 frontier AI data centers (updated May 2026) is the first open cross-site compilation using satellite imagery, permit filings, and company announcements to estimate compute, power, and capital cost at each site.

**Scale and concentration**: the dataset spans ~3.7M H100-equivalents across 43 sites. The top five sites account for roughly 60% of measured compute. Capital investment is heavily concentrated: the single largest site (Anthropic-Amazon New Carlisle, 686k H100-eq / 1,092 MW / $34.9B) exceeds the combined estimated capex of the bottom 30 sites.

**Ownership vs tenancy split**: almost all frontier AI labs are tenants, not owners. [[Amazon]] owns and [[Anthropic]] rents; [[Microsoft]] owns and [[OpenAI]] rents; [[Oracle]] owns and [[OpenAI]] rents; [[xAI]] owns but [[Anthropic]] has signed a full-cluster lease on Colossus 1. The only lab that both owns and operates at scale in this dataset is [[Meta]] (Prometheus, Temple, Hyperion).

**Power as the binding constraint**: campus power ranges from 40 MW (Sines Portugal) to 1,092 MW (New Carlisle). Multiple sites in the dataset are permitted but at 0 current compute (Meta Hyperion 2.25 GW gas turbine applications pending, Stargate UAE under construction, Amazon Ridgeland under construction), reflecting that power infrastructure procurement leads compute deployment by 12–24 months.

**Hardware generation signals**: the largest new builds (post-2024) assume NVIDIA GB200/GB300 NVL72 servers; Google sites are TPU-estimated using cooling-tower satellite models. Alibaba Zhangbei uses China-available hardware (no H100 access); compute is back-calculated from power × efficiency of available alternatives.

**Geographic distribution**: US-concentrated (38 of 43 sites), with significant clusters in Ohio, Texas, Mississippi, and Iowa. International presence is nascent: Oracle Batam Indonesia, Start Campus Sines Portugal, Alibaba Zhangbei China, Stargate UAE. Stargate's stated plan to expand globally has not yet materialized in confirmed measured sites.

**Stargate as the largest single AI infrastructure commitment**: the Oracle–OpenAI $300B cloud contract (September 2025) and the Stargate JV structure it anchors represent a qualitatively different financing model from prior data center builds. The $300B is not capex — it is a revenue contract that funds Oracle's capex through project-finance debt (e.g., $18B New Mexico loan from 20+ bank consortium, $38B further under discussion), treating AI campuses like utility infrastructure. The Abilene TX campus (1.2 GW, 400k+ Nvidia GB200 GPUs, now live on OCI) is the first realized Stargate site; the JV has since expanded to nearly 7 GW planned capacity with $400B+ committed — dwarfing any single site in the Epoch.ai database. The capex-per-GW benchmark this establishes is $50–60B/GW for full-stack AI data center capacity. [[2026-01-22-oracle-openai-s-300b-deal-ai-infrastruct]]

**Stargate site-by-site rollout and international expansion**: IntuitionLabs' project guide details the site footprint in granular form. U.S.: Abilene flagship (1.2 GW, 450k GB200 GPUs), plus six follow-on campuses (Shackelford County TX, Doña Ana County NM, Midwest TBD, Lordstown OH, Milam County TX, Saline Township MI "The Barn") bringing total planned U.S. capacity to 8+ GW. International "OpenAI for Countries": UAE 1 GW (G42 JV, 200 MW by 2026), Norway 230 MW (Narvik hydropower, liquid cooling + waste heat), UK Nscale Cobalt Park (31k GPUs), Argentina 500 MW / $25B (Patagonia, first 100 MW 2027). Technology roadmap: current GB200 NVL racks succeeded by Vera Rubin in H2 2026; custom "Titan" inference chip (Broadcom + TSMC 3nm) mass production also H2 2026 targeting 10 GW deployment by 2029. [[2026-01-22-openai-s-stargate-project-a-guide-to-the]]

## Observations

- [[xAI]] Colossus 2 (Memphis, TN) went operational 2026-01-17 as the world's first 1 GW AI training cluster, dedicated to training [[Grok]]; [[xAI]] plans a scale-up to 1.5 GW in April 2026. — [[2026-01-19-x-上的-elon-musk-the-colossus-2-supercompu]]

## Open threads

- Meta Hyperion power timeline: three 752 MW gas turbines + 1.8 GW MISO substation are permitted but not operational — when does Hyperion join the measured dataset?
- Non-US Stargate sites: announced but not yet quantified by Epoch.ai methodology.
- China frontier compute: Alibaba Zhangbei is the only Chinese site in the dataset; Huawei Ascend-based campuses and ByteDance data centers are not represented.
- Oracle counterparty risk: Moody's negative outlook on Oracle's Baa2 rating warns potential 4× EBITDA leverage. If OpenAI cannot grow into the $60B/year obligation or renegotiates, what happens to the campus financing structures?

## Sources drawn on

- [[2026-01-22-data-on-frontier-ai-data-centers]] — Epoch.ai's 43-site open database; primary source for all quantitative claims above.
- [[2026-01-22-oracle-openai-s-300b-deal-ai-infrastruct]] — IntuitionLabs deep-dive on the Oracle–OpenAI $300B contract; Stargate buildout status through April 2026; project-finance mechanics; capex-per-GW benchmark.
- [[2026-01-22-openai-s-stargate-project-a-guide-to-the]] — IntuitionLabs project guide (revised Feb 2026); site-by-site U.S. campus rollout; international "OpenAI for Countries" deployments; hardware timeline (Vera Rubin, Titan chip).
- [[2026-01-15-economictimes-indiatimes-com]] — Economic Times overview of OpenAI's trillion-dollar deal spree (Oracle +$300B, NVIDIA +$100B 10GW, AMD 6GW+10% equity, Broadcom 10GW, SK Hynix/Samsung HBM); stock surge mechanics and AI bubble concern framing.
