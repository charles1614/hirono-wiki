---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://epoch.ai/data/data-centers
tags: [pretraining, inference, gpu, accelerator-design, benchmark]
---

# [2026-01-22] Data on Frontier AI Data Centers

## TL;DR

Epoch.ai's open database of 43 large AI data centers (updated May 2026), cross-referenced from satellite imagery, permit filings, and company announcements. The dataset quantifies each site's H100-equivalent compute, power draw (MW), and estimated capital cost (2025 USD billions). The top five sites alone represent ~3.4 million H100-equivalents and 2.97 GW of power. [[Microsoft]], [[Amazon]], [[Meta]], [[Google]], and [[xAI]] dominate; [[OpenAI]]'s [[Stargate]] Abilene is the largest pure-OpenAI-tenant site. [[Anthropic]] appears as a tenant at four separate sites.

## Key claims

- **Top-5 sites by H100-equivalents** (as of May 2026):
  | Name | H100-eq (k) | Power (MW) | CapEx ($B) | Owner | Primary tenant |
  |---|---|---|---|---|---|
  | Anthropic-Amazon New Carlisle | 686 | 1,092 | $34.9 | Amazon | Anthropic |
  | Microsoft Fairwater Wisconsin | 559 | 555 | $17.7 | Microsoft | OpenAI / Microsoft |
  | Meta Prometheus | 494 | 531 | $15.6 | Meta | Meta |
  | QTS Richmond | 492 | 854 | $32.7 | QTS | — |
  | Microsoft Fairwater Atlanta | 374 | 433 | $11.9 | Microsoft | OpenAI (speculative) |

- **Anthropic-Amazon New Carlisle** (New Carlisle, Indiana) is the single largest measured site at 686k H100-eq / 1,092 MW / $34.9B — part of [[Project Rainier]]. Uses direct air cooling (no external chiller loops), a pattern repeated across Amazon's Anthropic-linked campuses.

- **[[xAI]] Colossus 1 + 2** together total ~557k H100-eq at ~$20B capital cost. Colossus 1 (425 MW, converted factory in Memphis) was announced in May 2026 as fully leased by [[Anthropic]] via SpaceX agreement. Colossus 2 adds natural gas turbines sited across the Mississippi border for permitting speed; [[Cursor]] is a confirmed tenant.

- **[[Stargate]] Abilene** (Oracle-owned, OpenAI tenant): 255k H100-eq / 295 MW / $8.1B — the first of several US and international Stargate sites. A second site, Stargate UAE (Abu Dhabi, G42-likely), is under construction with compute estimates constrained by reported 100k-chip/year US export approval.

- **[[Meta]] Hyperion** (Richland Parish, Louisiana): 0 current compute, 0 current power — site is permitted but not yet operational. Entergy has applied for three 752 MW gas turbines; MISO has planned a 1.8 GW substation. Expected to be Meta's next flagship cluster after [[Meta]] Prometheus.

- **Google** operates five data centers in the dataset: Columbus (215k H100-eq), New Albany (207k), Omaha (136k), Council Bluffs East (92k), Storey County Nevada (89k), and Pryor Oklahoma (18k). All attributed to Google DeepMind as primary tenant. Power estimates derived from cooling-tower satellite models and transmission-permit disclosures.

- **[[CoreWeave]]** appears via Core Scientific's Denton TX facility (126k H100-eq / 183 MW / $2.9B), a converted bitcoin mining plant being repurposed for AI; CoreWeave contracted 260 MW scheduled for mid-2026.

- **International sites**: Oracle Batam (Indonesia, DayOne campus, 84k H100-eq / 94 MW / $2.75B); Start Campus Sines (Portugal, Microsoft/Nscale tenant, 32k H100-eq / 40 MW / $1.27B, hosts Europe's first NVIDIA GB300 chips). Alibaba Zhangbei (China, 133k H100-eq / 203 MW, part of "Eastern Data Western Compute" 东数西算 project).

- **Methodology**: compute capacity is back-calculated from power capacity using energy-efficiency estimates for the chip generation available when each building became operational (H100-equivalent normalization). Confidence labels (`#confident`, `#likely`, `#speculative`) are attached to each owner/tenant assignment; this dataset is the primary open-access compilation of such satellite-derived estimates.

- **Capital cost concentration**: the top 10 sites account for $148B in estimated capital investment; the Anthropic-Amazon New Carlisle site alone ($34.9B) exceeds the total of the bottom 30 sites combined.

## Visual observations

*No load-bearing images — source is a structured data table; all quantitative claims are extracted into Key claims above.*

## What this changes

- Provides the first open cross-site comparison of frontier AI data center scale — prior to this dataset, compute concentration was discussed anecdotally; now specific H100-equivalent capacities and capital costs are citable.
- Confirms [[Anthropic]] is among the largest compute consumers globally (tenant at New Carlisle 686k H100-eq, Madison Mega Site, Ridgeland, Colossus 1, Fluidstack Lake Mariner), despite owning no data centers.
- The Colossus 1 Anthropic announcement (May 2026) and Meta Hyperion permitting signal that the frontier is still expanding rapidly beyond the current 43-site dataset.

## Entities touched

[[Microsoft]], [[Amazon]], [[Meta]], [[Google]], [[OpenAI]], [[NVIDIA]], [[Anthropic]], [[xAI]], [[Oracle]], [[CoreWeave]], [[Stargate]], [[Project Rainier]]

## Topics touched

[[AI Data Centers]], [[Training Infrastructure]], [[Accelerator Economics]]

## Raw source

[epoch.ai/data/data-centers](https://epoch.ai/data/data-centers) — live database page (updated May 8, 2026); top-30-of-43 rows captured; 8-of-15 columns shown in raw (full CSV 15 columns × 43 rows available at epoch.ai/data/data_centers/data_centers.csv). Read 2026-05-15.
