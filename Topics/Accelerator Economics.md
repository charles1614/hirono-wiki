---
created: 2026-04-19
updated: 2026-04-19
type: topic
source_count: 1
---

# Accelerator Economics

How the cost/perf curve of ML training and inference bends across accelerator generations and vendors. Total cost of ownership (TCO) vs raw FLOPs; hyperscaler-custom silicon vs commodity GPUs; perf-per-TCO as the optimization target rather than peak TFLOPs.

## Current understanding

Hyperscalers optimize their internal workloads for perf/TCO (not perf/TFLOPs). AWS's framing for [[Trainium3]] is explicit: the internal benchmark was perf/TCO for [[Bedrock]] and [[Anthropic]] — opening the stack to public customers is a broadening move, not a first-principles redesign. That implies the chip's economics are already tuned to hyperscaler reality; the question is how those economics translate to outside workloads.

## Open threads

- What's the Trainium3 perf/$ relative to H100/B200 for typical (non-elite-kernel) PyTorch workloads?
- How much of AWS's perf/TCO advantage is silicon vs software + scheduling integration inside their own data centers?

## Sources drawn on

- [[2026-04-19-aws-trainium3-deep-dive]] — perf/TCO as AWS's optimization target for Trainium3
