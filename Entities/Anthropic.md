---
created: 2026-05-12
updated: 2026-05-16
type: entity
refs: 22
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
- Cited as needing to rebuild its NVIDIA partnership because [[TPU]] v8's eroding TCO advantage (VR200/TPUv8p gap now 1.23×, down from GB200/TPUv7 1.52×) makes it impractical to rely exclusively on TPUs long-term as NVIDIA's iteration pace accelerates. — [[2026-01-15-tpu-vs-gpu-全面技术对比-谁拥有-ai-算力最优解]]
- [[Claude Code]] bug (GitHub issue #4049): a pre-flight Haiku API call gates each Bash invocation; AWS Bedrock 403 from missing model-access permissions caused ~210-second hangs before any command ran; fixed by enabling Haiku 3.5 model access in Bedrock and adding a diagnostic log. — [[2025-10-29-significant-pre-execution-delay-210s-whe]]
- Internal Anthropic blog (Jul 2025): teams across the company report Claude Code reducing incident response 3× (Security Engineering: stack trace analysis), compressing documentation research 80% (Inference team: 60 min → 10-20 min), enabling non-engineers to build custom tools (Legal: phone-tree systems; Marketing: hundred-variation ad generators), and replacing data catalog tools for new-hire onboarding (Infrastructure). Key pattern: best results when teams treat it as a thought partner not a code generator. — [[2025-07-25-how-anthropic-teams-use-claude-code-anth]]

- Claude Code issue #4002 (Jul→Dec 2025): 25,000-token file read limit prevents single large files from consuming the full context window; the model can still read entire files via multiple offset/limit reads. MCP tool output limit is separately configurable via `MAX_MCP_OUTPUT_TOKENS`. Rationale confirmed by Anthropic contributor catherinewu. — [[2025-11-27-error-file-content-28375-tokens-exceeds-]]
- Alibaba Cloud developer describes [[Claude Code]] as "master model + 15 tools" with superior context management vs. Cline; recommends pseudo-XML prompting structure for Claude models specifically; noted as the tool that enabled a full Hackathon project (design docs, diagrams, code) by one developer. — [[2025-07-30-如何用ai-coding和claude-code提升开发效率-看我的全流程复盘]]
- MCP（Model Context Protocol）由Anthropic于2024年11月25日发布，定位为LLM与外部数据源/工具之间的"USB-C万能转接头"；相比各平台独立function call实现，MCP提供统一协议层，使任何支持MCP的模型可无缝复用同一Server，核心优势是平台无关性和数据安全（敏感数据留本地）。 — [[2025-06-04-https-zhuanlan-zhihu-com-p-29001189476]]
- [[Pine AI]]'s chief scientist cited an Anthropic research result demonstrating SFT+RLHF teaches a model to follow 51 arbitrary "strange" rules simultaneously (e.g., "always mention chocolate in recipes") without long-think-mode — the recommended path for domain-specific compliance on smaller open-source models. Claude 4 Sonnet is used by Pine as the Reasoner model for deep planning. Computer use by Anthropic/OpenAI is cited as the performance baseline Pine's RPA-based GUI system outperforms by 5×. — [[2025-06-14-能办成事的-agent-实时与环境交互-从经验中学习]]
