---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# AWS

Amazon Web Services; hyperscaler; custom silicon (Trainium, Graviton, Nitro)

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Hardware North Star: fastest time to market at lowest TCO, not peak raw FLOPs. Applied across rack design (air-cooled Trn3 NL32x2 Switched deployable in legacy datacenters), supply chain (multi-sourcing, Astera Labs/Credo equity-warrant rebates), and switch roadmap (PCIe Gen1 → Gen2 → UALink upgrade-in-place). — [[2026-02-04-aws-trainium3-deep-dive-a-potential-chal]]
- Project Rainier multi-gigawatt datacenter buildout ongoing; new metro-area campus scaling to 1 GW with adjacent 1 GW site under construction. Air-cooled datacenter design essentially unchanged from 2021 — deliberate fungibility/TCO decision, not a delayed response to liquid-cooling trend. — [[2026-02-04-aws-trainium3-deep-dive-a-potential-chal]]
- Bedrock internal workloads run a private fork of vLLM v1 (DeepSeek/Qwen etc.); Anthropic's workloads run a custom inference engine and all-custom NKI kernels — these two customers are the primary design constraint for [[Amazon Trainium]]. — [[2026-02-04-aws-trainium3-deep-dive-a-potential-chal]]
