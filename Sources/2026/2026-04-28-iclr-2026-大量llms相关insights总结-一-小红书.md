---
created: 2026-05-12
updated: 2026-05-12
type: source
source_url: https://www.xiaohongshu.com/discovery/item/69ed78f3000000001a034eed
tags: [post-training, inference, survey]
---

# [2026-04-28] ICLR 2026 大量 LLMs 相关 Insights 总结（一）

## TL;DR

An xhs (Xiaohongshu) post by **幸运降临中** dated 2026-04-28, summarizing **10 LLM-related ICLR 2026 papers** the author found interesting after a day spent walking the conference floor. The xhs body is a 50-word teaser; the substance is in 7 hand-built summary cards (~3000 Chinese chars total) that group the 10 insights into three sections: **(1) model structure / compression / internal representation**, **(2) inference-time search / sampling / multi-agent workflow**, **(3) RL post-training / control / embodied AI**. The author's qualitative read: ICLR 2026's lower-bound is comparable to AAAI, but the upper-bound is much higher. Each insight is a one-paragraph takeaway paired with the paper title — a high-quality entry point for tracking which 2026 LLM-papers are getting practitioner attention. Series of three notes; this is Part 1.

## Key claims

### Section 1 — Model structure, compression, internal representation

**Insight 1: Layer pruning is simpler than it looks.** *Reassessing Layer Pruning in LLMs: New Insights and Methods.* Don't bother with complex layer-importance metrics — directly drop the last N layers, then fine-tune **only the remaining model's last 3 layers + lm_head**. Outperforms metric-driven pruning + LoRA on both speed and stability.

**Insight 2: Forcing concept emergence via extreme sparsity.** *Sparling: End-to-End Spatial Concept Learning via Extremely Sparse Activations.* Setup: real-world tasks are `x → m → y` but training data only has `x → y`. Can a neural net be forced to learn the true intermediate variable `m` in a hidden layer? Yes — when the intermediate concept is sufficiently sparse AND sufficient for the output. Mechanism: compress the middle layer to *extreme* sparsity so the model can't abuse leaked-through information.

**Insight 3: LLM uncertainty isn't token probability.** *Trained on Tokens, Calibrated on Concepts: The Emergence of Semantic Calibration in LLMs.* For open-ended questions, the load-bearing quantity is the **semantic-equivalence-class probability**, not the individual token-string probability. Example: "Paris", "The capital is Paris", "Paris, France" are different token sequences but the same answer. Sample multiple times, merge synonyms; if 70% of samples cluster under the "Paris" semantic, treat 70% as the model's confidence in that answer. **Finding**: base models are well-calibrated at this semantic level, but **instruction tuning, DPO/RLHF, and CoT reasoning often break the calibration**. Post-trained models talk better; their stated confidence is less trustworthy.

### Section 2 — Inference-time search, sampling, multi-agent workflow

**Insight 4: Method-cluster-aware sampling beats raw repetition.** *GuidedSampling: Steering LLMs Towards Diverse Candidate Solutions at Inference-Time.* Complex-problem answer spaces aren't uniform — they're clusters of *solution methods* (e.g. a geometry problem has coord-based, similar-triangles, trig-identity, vector approaches). Repeat-sampling just reshuffles within a single method-cluster; ToT branches too finely. Branch **at the high-level method-cluster level** first, then sample normally within each.

**Insight 5: Best-of-N's real question is N, not the voting rule.** *Best-of-Infinity: Asymptotic Performance of Test-Time LLM Ensembling.* Fixed-N is wasteful — easy problems converge in 3 samples; hard problems aren't decided at 50. The actual target is **the eventual majority answer as N → ∞**. Use Dirichlet posterior on current vote counts to estimate whether the current leader is stable or random-noise-leading; early-stop when stability is high; keep sampling otherwise.

**Insight 6: Multi-agent systems don't auto-improve from more agents.** *Multi-Agent Design: Optimizing Agents with Better Prompts and Topologies.* Naively spawning predictor + reflector + debator + aggregator doesn't help. What works: **(a)** prompt-engineer each agent to reliably execute its role first; **(b)** search over **topology** (parallel vs reflective vs debate vs aggregation) explicitly; **(c)** **jointly optimize all agents' prompts against the final task metric** so upstream outputs align with downstream consumers. Treat the workflow as one system, not a bag of independent LLMs.

### Section 3 — RL post-training, control, embodied AI

**Insight 7: RL post-training gains don't auto-transfer across domains.** *Breaking Barriers: Do Reinforcement Post Training Gains Transfer To Unseen Domains.* RL in domain A boosts performance on A, but **transfer to unseen B is weak unless B's reasoning structure resembles A's** (e.g. math RL helps other math, but not legal/medical/financial/tabular reasoning). The "post-training generalizes" narrative needs domain qualifiers.

**Insight 8: Agent self-localization from action-conditioned video.** *Ego-Foresight: Self-supervised Learning of Agent-Aware Representations for Improved RL.* The pixels that move in lockstep with the agent's commanded action are the agent's body (or the tool it's currently controlling). No labels needed — repeated observation of `action → pixel-change` correlation lets the model learn "what is me vs what is environment." Downstream RL trains faster because the model already knows where to look.

**Insight 9: Opponent shaping in LLM-agent pairs.** *Opponent Shaping in LLM Agents.* When two LLM agents both update via PPO during interaction, agent A's behavior can **induce** agent B to learn a policy that favors A (or both). Direct application of opponent-shaping results from game theory + multi-agent RL to LLM-on-LLM interaction.

**Insight 10: In-Context RL as the Decision Transformer endpoint.** *Vintix II: Decision Pre-Trained Transformer is a Scalable In-Context Reinforcement Learner.* Future: one big action-model uses (state, action, reward) context to adapt to many tasks, instead of training one policy per task. Vintix II shows DPT (predict expert action given state + interaction history) + Flow-Matching action head + cross-domain training scales **from toy RL to robotics, driving, HVAC, PDE control**.

## Visual observations

7 hand-built summary cards (`69ed78f3000000001a034eed_01.jpg` through `_07.jpg`, 84–198 KB each, plain-text design). Total ~3000 Chinese chars across the cards; the xhs body is just teaser + tag-list. Two load-bearing covers below; the remaining 5 cards are supporting and their content is already extracted into Key claims.

**Card 01 — Title + Section 1 (model structure)** (`../../raw/raindrop/www.xiaohongshu.com/2026-04-28-iclr-2026-大量llms相关insights总结-一-小红书/69ed78f3000000001a034eed_01.jpg`)

![Title card "ICLR 2026 LLMs Insights" + first section's heading "一、模型结构、压缩与内部表征" with Insight 1 (Layer Pruning) starting](../../raw/raindrop/www.xiaohongshu.com/2026-04-28-iclr-2026-大量llms相关insights总结-一-小红书/69ed78f3000000001a034eed_01.jpg)

Title card sets the framing: 全文2986字 / 阅读需6分钟 across 3 grouped sections — model structure & compression (Insights 1-3), inference-time search & multi-agent (Insights 4-6), RL post-training & embodied AI (Insights 7-10).

**Card 05 — Section 2/3 transition (Multi-Agent + RL transfer)** (`../../raw/raindrop/www.xiaohongshu.com/2026-04-28-iclr-2026-大量llms相关insights总结-一-小红书/69ed78f3000000001a034eed_05.jpg`)

![Card containing Insight 6 (Multi-Agent Design — jointly optimize prompts + topologies) and the section-3 boundary into Insight 7 (RL post-training domain transfer)](../../raw/raindrop/www.xiaohongshu.com/2026-04-28-iclr-2026-大量llms相关insights总结-一-小红书/69ed78f3000000001a034eed_05.jpg)

The two most-cited practitioner findings sit at this section boundary: Multi-Agent Design's "jointly optimize prompts and topologies" recipe, and the RL-transfer corrective that RL gains don't auto-generalize across domains without structural similarity.

## What this changes

A **lightweight ICLR 2026 LLM-tracker** for the wiki. None of these 10 papers are individually deep-synthesis material (they're one-paragraph poster impressions, not the papers themselves), but several are worth following up on as their own Sources if they become load-bearing:

- **Insight 3** (semantic calibration) intersects with [[LLM Inference Systems]] uncertainty quantification — practitioners doing confidence-aware routing should know that post-trained models' stated probabilities are less trustworthy than the base model's.
- **Insight 5** (Best-of-Infinity / early-stopping ensembling) is a sampling-efficiency direction that affects inference-time compute budgets. Relates to [[Speculative Decoding]] economics — Dirichlet-posterior-based early-stop is a cheap, broadly applicable variant.
- **Insight 6** (multi-agent topology + joint prompt optimization) is the most-cited practitioner finding here; agentic systems get worse from naive multi-agent stacks.
- **Insight 7** (RL post-training domain transfer) is a corrective to the "RL improves reasoning generally" framing — narrows the claim to in-distribution reasoning structures.

The author indicates this is Part 1 of a 3-part series totaling 42 insights. The remaining two notes haven't been ingested yet — worth bookmarking for future fetch.

## Raw source

> Platform: Xiaohongshu (xhs) · 作者: **幸运降临中** · 互动: 1161 likes · 1834 collects · 11 comments
> Series: Part 1 of 3 (total 42 insights claimed across the series)
> Tags: #ICLR26, #ICLR, #iclr26, #论文总结, #科研分享, #论文分享, #故事汇, #大模型, #Agent
> Source identifiers (raw): `69ed78f3000000001a034eed` (xhs note ID); 7 image cards as `<note_id>_01..07.jpg`
> Image extraction: Opus subagent pass (see image-extract sibling for verbatim card contents; Source body above is synthesis-from-extract)
