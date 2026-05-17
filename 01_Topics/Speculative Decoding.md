---
created: 2026-05-11
updated: 2026-05-17
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 10
---

# Speculative Decoding

## What

Inference-time techniques that **run a cheap draft model to propose tokens, then verify them against the expensive target model** — when the verifier agrees, multiple tokens commit per target-model step, lowering per-token latency. The space covers draft-model design (independent small model, MTP head, EAGLE-style), draft-target alignment (number of draft tokens, tree-vs-linear draft shapes), and scheduling (how speculation interacts with continuous batching + KV cache). Distinct from but adjacent to [[Speculative Decoding]]'s economic-extension: **Best-of-N inference-time ensembling**, where the same target model is sampled N times and a vote / aggregator picks the answer — a different cost/quality trade than draft-target speculation but on the same compute budget axis.

<!-- merged from `Speculative Sampling` on 2026-05-13 -->

Latency-reduction technique that uses a small draft model to propose tokens, verified in parallel by the large target model.

## Current understanding

<!-- TODO: re-synthesize ## Current understanding (post-merge 2026-05-13) -->
**EAGLE-3 is the current production reference point and has resolved a long-standing batch-throughput objection.** [[2025-10-09-eagle-3-scalingupinference-acceleration-]] establishes a **scaling law** for speculative-decoding draft models: draft quality (and therefore tokens-per-step speedup) grows proportionally with training-data scale, a property that prior EAGLE generations and HASS couldn't achieve because their feature-prediction loss `l_fea` capped expressiveness. The three architectural changes driving this — dropping `l_fea`, multi-layer feature fusion (low/mid/high target-model features concatenated to a 3k-vector), and training-time test (feeding the draft model its own prior output during training to close the train/inference distribution gap) — together enable **up to 6.5× speedup** over the target model alone. Critically, the SGLang integration shows a **40% throughput improvement at batch size 64**, directly refuting the conventional wisdom that speculation degrades large-batch serving. That number is the load-bearing production result because large-batch throughput — not single-request latency — is where prior speculative methods lost out in real deployments.

**EAGLE-3 and DeepSeek cross-pollinated architecturally.** EAGLE-3's training-time test was inspired by V3's multi-token prediction (MTP) head design; conversely, V3/V4's MTP head at inference time functions as the speculative-decoding draft path. [[2026-04-27-deepseek-v4砍掉mla-一个月前有人预言了-小红书]] reports that V4's MTP `depth=1` is simultaneously the speculative-decoding path (V4 §3.3.3). The implication for the V4 lineage is significant: "Multi-Token Prediction" and "Speculative Decoding" are not separate features — they are the same head in two modes (training objective at pre-train, draft-token generator at inference). Full confirmation awaits the V4 paper ingestion, but the convergence is consistent across sources.

**Minimal production configurations are surprisingly compact.** [[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]] documents Ant Group's H20-96G deployment using **Simple Eagle**: `--speculative-algorithm NEXTN --speculative-num-steps 1 --speculative-eagle-topk 1 --speculative-num-draft-tokens 2`. The design choice is deliberate — minimal config delivers a meaningful TPOT win on small-batch decode without expanding the kernel complexity surface. Two follow-on PRs (#11398, #11434) added spec-overlap and CUDA-graphed draft post-processing, but the base config is four flags. This matches the pattern visible in [[2025-12-14-geeeekexplorer-nano-vllm-nano-vllm]]'s minimal inference stack: the effective design space is small once a working draft model exists.

**Speculation economics are hardware-sensitive in ways the throughput headline doesn't capture.** [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] doesn't benchmark speculation directly, but its Hopper FP8 findings are load-bearing context: the verify pass's Tensor Core utilization governs the cost/effectiveness threshold for speculation, and TE's current implementation leaves attention (softmax, GeLU, DotProductAttention) outside the FP8 path. A lower-utilization verify pass lowers the threshold at which draft-token acceptance needs to be to justify speculation — which is one reason EAGLE-3's acceptance rate improvements matter more than headline speedup ratios alone.

**Scheduling interaction with continuous batching remains the live frontier.** The Ant deployment separates prefill (TP8) and decode (DP16+EP16) using [[Inference Disaggregation]] because H20 hardware is lopsided. Within that disaggregated decode pool, speculation fits cleanly — the draft model runs on the decode-side GPUs, and SBO (Single-Batch Overlap) handles compute/communication overlap without the control-plane cost of Two-Batch Overlap. [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] doesn't address speculation explicitly, but its finding that disaggregated decode can pursue more aggressive TP than co-located decode creates a scheduling regime where speculation's batch-size sensitivity is different from co-located deployments — a gap in the corpus.

**Best-of-N ensembling occupies the adjacent but distinct position on the inference-compute axis.** [[2026-04-28-iclr-2026-大量llms相关insights总结-一-小红书]] (Insight 5, *Best-of-Infinity*) reframes Best-of-N as early-stopping when the current majority answer is statistically stable under a Dirichlet posterior of vote counts. The mechanism is orthogonal to draft-target speculation: Best-of-N samples the *same* target model N times and aggregates, while speculation runs a *cheaper draft* model to accelerate each target-model step. Both trade compute for quality, but at different points in the cost stack. The corpus has no data on whether combining them — speculating within each of N samples — yields compositional gain; it's an open question.

**The key open thread the corpus has not resolved** is whether a hybrid of EAGLE-3's draft architecture and V4's MTP-as-spec-decode pathway outperforms either alone. Both converged on the same intuition (train the draft on its own prior output distribution, fuse multi-layer features) but arrived independently. A joint ablation hasn't appeared in any ingested source.

<!-- merged from `Speculative Sampling` on 2026-05-13 -->

**Speculative sampling** (also called speculative decoding) is a latency-reduction technique for autoregressive language model inference. A small, fast **draft model** proposes a sequence of *k* candidate tokens in a single forward pass; the large **target model** then verifies all *k* tokens in a single parallel forward pass. Tokens accepted up to the first rejection are kept verbatim; the first rejected token is resampled from the target distribution. Because the target model's forward pass is parallelized over the draft sequence, wall-clock time per accepted token drops substantially when the draft acceptance rate is high — without changing the output distribution of the target model.

The **correctness guarantee** is the technique's most important property: with an appropriately constructed acceptance/rejection rule, the joint output distribution is provably identical to what the target model would produce by sampling token-by-token. This is not an approximation; it is an exact match. The acceptance probability for draft token *x* at position *t* is min(1, p_target(x|context) / p_draft(x|context)), and a correction sample is drawn on rejection. The result is that speculative decoding is a drop-in replacement for standard sampling — no fine-tuning, no quality degradation.

**Throughput and latency tradeoffs** depend on three factors: (1) the draft model's speed advantage relative to the target, (2) the draft acceptance rate (a function of how well the draft distribution approximates the target's), and (3) the number of draft tokens *k* proposed per verification round. In practice, draft models that are 5–10× smaller than the target and domain-matched to the workload achieve acceptance rates of 70–90 %, delivering 2–3× end-to-end speedups on generation-heavy tasks without additional hardware.

Several **variants and extensions** have been explored: *self-speculative decoding* (the target model drafts its own continuations using early-exit layers), *tree-based speculation* (the draft produces a token tree rather than a linear sequence, allowing multiple candidate continuations to be verified simultaneously), and *medusa heads* (multiple auxiliary decoding heads attached to the target model predict tokens ahead without a separate draft model). Each variant trades implementation complexity against acceptance rate or hardware requirements.

**Practical deployment considerations** include draft model selection (must be fast, same tokenizer, reasonably correlated with target), batching dynamics (speculation is less beneficial when batch sizes are large because the target's compute is already well-utilized), and memory bandwidth (speculation shifts the bottleneck from memory-bandwidth to compute, which is the profitable regime on modern accelerators during memory-bandwidth-bound single-user inference).

The technique is now a standard component in serving stacks for large models; its value is highest in interactive, low-batch-size regimes (e.g., chat) and least in high-throughput offline batch inference where standard continuous batching already saturates hardware.

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

<!-- merged from `Speculative Sampling` on 2026-05-13 -->

- [[2026-01-13-腾讯angelslim重磅升级-面向全模态的大模型压缩算法工具包-推理速度飙升-]] — AngelSlim将Eagle3训练范式扩展至全模态（LLM/VLM/Audio），1.4-1.9×加速，vLLM/SGLang直接部署。
- [[2026-01-14-理想同学mindgpt-3-0发布-基于结构化思维链的深度思考模型]] — MindGPT 3.0车载LLM系统级推理优化：P-D分离、混合并行。
- [[2026-01-04-moonshot-seer-长度感知-分段处理-投机采样-97-吞吐提升]] — Seer's adaptive grouped speculative sampling: CST-based no-draft-model n-gram speculation for RL rollout long-tail; 74–97% throughput vs VeRL.

