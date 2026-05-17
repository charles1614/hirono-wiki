---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://intuitionlabs.ai/articles/oracle-openai-300b-deal-analysis
tags: [training, gpu, accelerator-design, production-deployment]
---

# [2026-01-22] Oracle & OpenAI's $300B Deal: AI Infrastructure Analysis

## TL;DR

IntuitionLabs deep-dive (revised April 2026) on the $300B, five-year Oracle–OpenAI cloud-compute contract announced September 2025. The deal commits OpenAI to ~$60B/year for 4.5 GW of OCI capacity starting 2027, and is the backbone of the broader Stargate buildout (now ~7 GW planned, $400B+ committed). By April 2026 the flagship Abilene TX campus (1.2 GW, Oracle Cloud Infrastructure, 400k+ Nvidia GB200 GPUs) is live; OpenAI has raised $122B at an $852B valuation; Oracle's RPO has swelled to $523B. The deal simultaneously crystallises a new order of infrastructure financing, validates Oracle as a hyperscale AI cloud, and exposes significant execution and counterparty risk on both sides.

## Key claims

- **Contract terms**: $300B over five years (2027–2032), ~$60B/year implied. Covers 4.5 GW of Oracle Cloud Infrastructure capacity annually — equivalent to powering ~4 million homes. Announced September 10, 2025 (WSJ first report, Reuters confirmed). One of the largest commercial cloud contracts ever signed.
- **Stargate expansion**: Stargate JV (OpenAI + Oracle + SoftBank, announced January 2025) has grown from a $500B, ~10 GW initial commitment to nearly 7 GW planned capacity with over $400B in near-term investment. Five original sites expanded to Michigan, Wisconsin, Wyoming, and Pennsylvania. Abilene TX flagship is the first live site.
- **Abilene campus**: 4 million sq ft, 1.2 GW, 8 buildings (topped out Q1 2026), operational on OCI. Built by Crusoe (~$15B total funding including $1.38B Series E at ~$10B valuation). Houses hundreds of thousands of Nvidia GB200 GPUs in liquid-cooled H-shaped hall design. ~6,000 construction workers; ~1,700 permanent jobs. Microsoft separately leased 900 MW from Crusoe's adjacent site (that OpenAI declined to expand), making the two companies literal neighbors on separate compute strategies.
- **Oracle's position**: RPO surged from $455B (Q1 FY2026) to $523B by Q3 FY2026 (+438% YoY). Q3 FY2026 revenue +22% to $17.2B; cloud revenue +44% to $8.9B; IaaS +68% to $4.1B — best organic quarter in 15+ years. Oracle raised $30B in debt/equity in early 2026 to fund the buildout; FY2026 capex guidance raised $15B to ~$50B total. Stock +43% on deal announcement but -24% YTD by April 2026 amid AI bubble concerns. Moody's flagged negative outlook: potential 4× EBITDA leverage from AI capex.
- **Hardware pipeline**: Oracle committed ~$40B to purchase ~400,000 Nvidia GB200 GPUs for Abilene. Nvidia committed up to $100B in chip supply to the Stargate initiative. Next-generation Vera Rubin chips planned for 2026–2027 sites. AMD: OpenAI reportedly committed 6 GW with AMD (MI300-series).
- **OpenAI–Broadcom custom silicon**: OpenAI and Broadcom announced in October 2025 a custom AI inference chip co-development. Design phase completed by early 2026; first deployment targeted H2 2026 for "o1"-series inference. Platform uses Ethernet-based Broadcom interconnect. 10 GW of Broadcom-based AI hardware targeted by 2029 at ~$50–60B/GW capex. Broadcom has since agreed to similar custom chip deals with Google and Anthropic.
- **OpenAI finances**: revenue $6B (2024) → $20B (2025 confirmed by CFO Sarah Friar) → $25B ARR (February 2026, ~$2B/month). 9M+ paying business users. Advertising pilot launched March 2026: $100M ARR within two months; $2.5B ad revenue projected for 2026, $100B target by 2030. Projected 2026 net loss: ~$14B. Long-term projected spending through 2029: ~$115B. $60B/year Oracle obligation is ~2.5× current monthly revenue × 12 — gap requires ongoing external funding.
- **March 2026 funding round**: $122B raised at $852B valuation. Key investors: Amazon ($50B, ~$35B contingent on IPO or AGI milestones), Nvidia ($30B), SoftBank ($30B), Andreessen Horowitz, Microsoft. Largest single investor is Amazon, now both cloud provider and major equity stakeholder. Total equity raised exceeds $170B. IPO targeted Q4 2026 at ~$1 trillion valuation goal; $280B annual revenue targeted by 2030.
- **Corporate restructuring**: OpenAI converted to Public Benefit Corporation (PBC) in late 2025. Nonprofit Foundation holds $130B stake; Microsoft retains ~27% ownership (~$135B post-restructuring).
- **Competitive context**: Amazon's $38B OpenAI cloud deal (November 2025) and $50B equity investment position AWS as dual provider + stakeholder. Anthropic reportedly passed OpenAI at $30B ARR by April 2026 while spending 4× less on training — direct competitive pressure from capital-efficient rivals. Oracle also in talks for ~$20B deal with Meta. Oracle now serves all top five AI models on OCI.
- **Infrastructure financing mechanics**: ~$18B project loan from 20+ bank consortium for New Mexico campus (SOFR+2.5%, 4-year maturity); $38B further bank lending under discussion. Oracle Texas Abilene financed via $9.6B bank debt + $5B equity from Blue Owl Capital/Valor. These project-finance vehicles treat data center campuses like infrastructure utilities — a structural financing shift.
- **Capex intensity**: $50–60B per GW of AI data center capacity (Broadcom deal figure). At 4.5 GW/year, the Oracle deal implies ~$225–270B in underlying capex to be deployed by Oracle over the contract term — the revenue stream finances the debt.

## Visual observations

*No load-bearing images — source has no images* (the header image is decorative; no charts, diagrams, or figures carrying data beyond what is stated in text).

## What this changes

- **Sets a new infrastructure financing template**: bank project-finance for data center campuses (the New Mexico $18B loan, the $38B under discussion) establishes a new precedent — AI infrastructure financed like toll roads or power plants, not like typical tech capex.
- **Confirms Oracle as a genuine hyperscale AI cloud**: $523B RPO and 68% IaaS YoY growth places Oracle in the same order of magnitude as AWS/Azure for AI workloads — a structural change from its historical enterprise-software identity.
- **Crystallises OpenAI's cloud diversification strategy**: the shift from Azure exclusivity to Oracle + AWS + Azure reflects a deliberate multi-cloud hedge. Microsoft's relaxation of exclusivity clauses in early 2025 enabled it. The Abilene neighbor dynamic (Microsoft 900 MW vs OpenAI's campus) illustrates how quickly the partnership has differentiated.
- **Quantifies the capex-per-GW ceiling**: $50–60B/GW is now a cited benchmark for full-stack AI data center capex. Combined with the Broadcom 10 GW target (~$500–600B implied), it makes the aggregate Altman "trillions" estimate legible.

## Entities touched

[[Oracle]], [[OpenAI]], [[Stargate]], [[NVIDIA]], [[Microsoft]], [[Broadcom]], [[SoftBank]]

## Topics touched

[[AI Data Centers]], [[Accelerator Economics]]

## Raw source

[intuitionlabs.ai/articles/oracle-openai-300b-deal-analysis](https://intuitionlabs.ai/articles/oracle-openai-300b-deal-analysis) — IntuitionLabs deep-dive article, revised April 11, 2026. Originally published January 22, 2026. ~128 KB HTML → ~128 KB raw markdown.
