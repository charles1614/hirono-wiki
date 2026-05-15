---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 13
tier: active
---

# Anthropic

AI safety company whose two engineering blog posts on effective harnesses for long-running agents are core references for the course.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Signed the largest external [[TPU]] deal to date: 1M [[Ironwood]] TPUv7 units split 400k direct purchase (~$10B in finished racks, sold by [[Broadcom]] directly to Anthropic) + 600k GCP rental (estimated $42B RPO). Fluidstack handles on-site setup; TeraWulf and Cipher Mining supply DC infrastructure. — [[2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro]]
- Has ex-Google compiler engineers enabling custom TPU kernels and high MFU; SemiAnalysis estimates Anthropic can reach 40% MFU on Ironwood, yielding ~52% lower TCO per effective PFLOP vs [[Blackwell]] GB300 NVL72. Opus 4.5 trained on TPU; ~67% API price cut attributed in part to infrastructure cost reduction. — [[2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro]]
- Published "The Complete Guide to Building Skills for Claude" (32 pages, Feb 2026): Skills are folder-based reusable instruction packages with a 3-layer progressive-disclosure load (YAML frontmatter ~100 tokens always-on → SKILL.md body on-demand → scripts/references on-demand). Targets 90% auto-trigger accuracy via well-authored `description` fields; primary use cases are document generation, workflow automation, and MCP-augmented orchestration. — [[2026-02-19-春节加餐-anthropic首个公开的skills构建指南来了]]
- Epoch.ai data center database (May 2026): appears as tenant at four sites — Anthropic-Amazon New Carlisle (686k H100-eq / 1,092 MW / $34.9B, part of [[Project Rainier]]; largest frontier site globally), Amazon Madison Mega Site (214k / 341 MW, speculative Rainier), Colossus 1 (276k / 425 MW, [[xAI]] Memphis — Anthropic signed agreement with SpaceX May 2026 for full cluster), and Fluidstack Lake Mariner (72k / 68 MW, NY — Google TPUs). Anthropic owns none of these facilities. — [[2026-01-22-data-on-frontier-ai-data-centers]]
