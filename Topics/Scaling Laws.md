---
created: 2026-05-11
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 8
---

# Scaling Laws

## What

*Stub topic — to be expanded from sources.*

## Current understanding

The corpus currently holds two concrete data points on scaling laws, both from the inference side rather than the classical pretraining literature.

**The foundational pretraining story is not yet in the corpus.** The Kaplan et al. (2020) and Hoffmann et al. / Chinchilla (2022) papers — which established that LLM loss follows power-law curves in parameters, tokens, and compute, and that compute-optimal training requires roughly equal scaling of parameters and tokens — are not yet ingested as Sources. The DeepMind "How to Scale Your Model" book (`jax-ml.github.io/scaling-book`) has been flagged as a high-priority ingest target by Jason 武器库 ([[2026-04-16-我在-汪志鹏的笔记下发布了一条评论-训练-infra-最好的资料应该就是-dee]]) but is not yet a corpus Source. Until those land, the topic's pretraining layer rests on background knowledge rather than cite-able Sources.

**From the inference side, the corpus has one load-bearing empirical finding**: [[2025-10-09-eagle-3-scalingupinference-acceleration-]] reports that EAGLE-3's draft-model speedup scales proportionally with training-data volume — a relation that did not hold for EAGLE or EAGLE-2 because their feature-prediction loss `l_fea` capped the expressiveness of the draft model. Once that architectural constraint was removed (dropping `l_fea`, adding multi-layer feature fusion + training-time test), a clean scaling curve emerged. The paper explicitly notes this is "never observed in previous works" for speculative-decoding systems. The lesson generalizes: **architectural constraints can suppress scaling behavior that is latent in the data**. Removing a constraint is sometimes enough to unlock a new scaling axis.

**The VLA / embodied-AI angle offers a domain-specific corrective**: Chen Long of Xiaomi ([[2026-04-14-见谈-小米陈龙-把大模型抚养到18岁-再教它如何驾驶]]) observes that classical pretraining scaling law returns are **diminishing specifically in the VLA (Vision-Language-Action) modality**. The claim is that "one question, one image, one answer" underrepresents how much data a VLA training run actually needs — the effective data unit is a (video, action, annotation) tuple, not a text token count, so the Chinchilla-style token-compute ratio doesn't directly transfer. A new scaling curve for VLA requires new-modality data (V+L+A jointly), not simply more text tokens. This is a narrowing rather than a refutation of the classical story: the power-law structure is expected to hold once the right data axes are identified.

**Inference-time compute scaling** is represented only in passing so far. [[2026-04-26-大模型推理八股-小红书]] lists "Inference-Time Compute Scaling: CoT, process reward models, DeepSeek R1, o1-style" as a chapter in the 2026 interview pocket-notes PDF — confirming that practitioners now treat this as a distinct axis — but the PDF itself is not yet ingested. [[2026-04-28-iclr-2026-大量llms相关insights总结-一-小红书]] notes that Best-of-Infinity-style early stopping is a sampling-efficiency technique that affects inference-time compute budgets. Neither constitutes a first-hand treatment of inference-time scaling law curves.

**Where Sources agree**: removing architectural constraints unlocks scaling (EAGLE-3); classical pretraining scaling laws do not automatically transfer to new modality combinations without re-identifying the right data axes (Xiaomi/Chen Long). Both points converge on the same meta-principle — scaling laws are **not universal constants but regime-specific empirical regularities** that depend on what the bottleneck is at a given scale. Finding the right axis is as important as investing in more compute or data.

**Where the corpus needs Sources**: the foundational pretraining laws (Kaplan, Chinchilla), inference-time scaling (o1-family / process reward model papers), and the DeepMind scaling book. The current wiki entry should be treated as an anchor for those ingests, not a settled synthesis.

## Open threads

## Observations

- Karpathy (2025 review): RLVR introduced a new test-time compute scaling axis — longer reasoning traces = higher capability — and caused labs to redirect pretraining compute budget toward RL runs; compute-optimal pretraining is no longer the sole scaling axis. Combined with RLVR's domain-specific performance spikes ("jagged intelligence"), classical benchmark scores no longer reliably track capability. — [[2025-12-20-2025-llm-year-in-review]]

## Sources drawn on

- (auto-populated by reindex)
