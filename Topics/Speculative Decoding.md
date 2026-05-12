---
created: 2026-05-11
updated: 2026-05-12
type: topic
source_count: 9
---

# Speculative Decoding

## What

Inference-time techniques that **run a cheap draft model to propose tokens, then verify them against the expensive target model** — when the verifier agrees, multiple tokens commit per target-model step, lowering per-token latency. The space covers draft-model design (independent small model, MTP head, EAGLE-style), draft-target alignment (number of draft tokens, tree-vs-linear draft shapes), and scheduling (how speculation interacts with continuous batching + KV cache). Distinct from but adjacent to [[Speculative Decoding]]'s economic-extension: **Best-of-N inference-time ensembling**, where the same target model is sampled N times and a vote / aggregator picks the answer — a different cost/quality trade than draft-target speculation but on the same compute budget axis.

## Current understanding

**EAGLE-3 is the 2025-2026 reference point.** [[2025-10-09-eagle-3-scalingupinference-acceleration-]] establishes a **scaling law** for speculative-decoding draft models — the draft-model quality (and therefore the practical token-per-step speedup) scales smoothly with draft-training compute. The production headline: **40% throughput improvement at batch size 64 on SGLang**, refuting the conventional wisdom that speculation degrades large-batch throughput. The number is critical because large-batch is where pre-EAGLE speculation lost out — pure latency-pool benefits don't matter if the serving cluster saturates batch throughput.

**DeepSeek-V3 and EAGLE-3 cross-pollinated.** V3's multi-token prediction (MTP) head was inspired by EAGLE; EAGLE-3 was inspired by V3's MTP design. The corpus has an Open thread on whether a hybrid is better than either.

**Production minimal configurations are very short.** From [[2025-12-14-geeeekexplorer-nano-vllm-nano-vllm]] and [[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]]:
- The Ant SGLang deployment ships **Simple Eagle** on H20-96G: `--speculative-algorithm NEXTN --speculative-num-steps 1 --speculative-eagle-topk 1 --speculative-num-draft-tokens 2`. Minimal config + practical TPOT win without complicating the kernel zoo.
- nano-vllm shows the same pattern at a smaller scale; the design space is unusually small once a working draft model exists.

**Hopper microbenchmark intersection.** [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] doesn't measure speculation directly but flags that speculative-decoding throughput-economics depend on Tensor Core utilization of the verify pass — a higher TC-util verifier (e.g. FP8 / MXFP4 quantized) raises the cost/effectiveness threshold for speculation.

**Adjacent direction: Best-of-N ensembling.** [[2026-04-28-iclr-2026-大量llms相关insights总结-一-小红书]] (Insight 5, *Best-of-Infinity*) reframes the Best-of-N decision as **early-stopping when the current majority answer is statistically stable under Dirichlet posterior of vote counts**. Different cost mechanism from draft-target speculation, but same goal (more inference-time compute → better answer per FLOP). The two approaches compose in principle — speculate within each of N samples — but compositional gain is unstudied in the corpus.

**V4's MTP-as-spec-decode pathway.** [[2026-04-27-deepseek-v4砍掉mla-一个月前有人预言了-小红书]] reports that V4's MTP `depth=1` is also the speculative-decoding path (V4 §3.3.3 in the cited panel). The implication: in the V4 lineage, "Multi-Token Prediction" and "Speculative Decoding" are not separate features — they're the same head used in two modes (training-objective at pre-train, draft-token at inference). Confirmation pending V4 paper ingest.

## Open threads

- Does the EAGLE-3 scaling law hold beyond 8B targets? The 70B numbers are good but the data-scaling curve isn't shown there, and prior scaling laws have inflection points — where does the draft-model curve plateau at 10× more data? — [[2025-10-09-eagle-3-scalingupinference-acceleration-]]
- DeepSeek-V3's multi-token prediction was inspired by EAGLE; EAGLE-3 was inspired by DeepSeek-V3's MTP. Is there a hybrid better than either? — [[2025-10-09-eagle-3-scalingupinference-acceleration-]]
- Disagg × speculation interaction is unexplored. Would EAGLE-style draft-model speculation benefit relatively more in a disaggregated serving setting (the decode pool can size for the draft-model concurrency)? — [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] [[2025-10-09-eagle-3-scalingupinference-acceleration-]]
- Do speculation + Best-of-N ensembling compose? Each addresses a different inference-time compute budget axis (draft-target acceleration vs sample-multiplicity); the combined pareto curve is unstudied. — [[2026-04-28-iclr-2026-大量llms相关insights总结-一-小红书]]

## Sources drawn on

- [[2025-10-09-eagle-3-scalingupinference-acceleration-]] — the EAGLE-3 scaling-law paper; production-grade 40% throughput at batch=64 on SGLang.
- [[2025-12-14-geeeekexplorer-nano-vllm-nano-vllm]] — minimal speculation config in a small inference engine; pedagogical reference.
- [[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]] — Simple Eagle (NEXTN) production config on H20-96G DeepSeek; spec-overlap + CUDA-graphed draft post-processing PRs cited.
- [[2026-04-28-iclr-2026-大量llms相关insights总结-一-小红书]] — Best-of-Infinity early-stopping ensembling (adjacent direction).
- [[2026-04-27-deepseek-v4砍掉mla-一个月前有人预言了-小红书]] — V4's MTP-as-spec-decode pathway (per panel-image citation; pending V4-paper verification).
