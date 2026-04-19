---
created: 2026-04-19
updated: 2026-04-19
type: source
raw_source: https://my.feishu.cn/wiki/MoGHwoPFeiDsj9ksdSxcST6mnEI
tags: [pretraining, foundations, llm]
---

# [2026-04-19] 大语言模型预训练 — Chapter 3 of 大语言模型知识库

## TL;DR

Foundational chapter defining [[Pretraining]] as a transfer-learning regime: instead of random-initialized parameters, you run a large-data preliminary training pass to extract "commonalities," then [[Fine-tuning|fine-tune]] on task-specific data. The case for pretraining rests on four structural problems it addresses — label scarcity, prior-knowledge, transfer across tasks, and interpretability via learned abstractions.

## Key claims

- Pretraining is a special case of [[Transfer Learning]]: train parameters on a source task, use those parameters as initialization for the target task, then fine-tune.
- LLM pretraining specifically is characterized by two scale properties: enormous training data volume **and** enormous model size. The data + model conjunction is what distinguishes "LLM pretraining" from generic pretraining.
- Four motivating problems pretraining addresses:
  1. **Data scarcity** — labeled data is expensive; pretraining leverages unlabeled data.
  2. **Prior knowledge** — tasks require world/linguistic priors; pretraining bakes them in.
  3. **Transfer learning** — many tasks share latent structure (e.g. semantic understanding); pretraining captures the shared latent before specializing.
  4. **Interpretability** — learned abstractions (word/phrase representations) are reusable and inspectable.
- Baseline training mechanics invoked: [[Backpropagation]] and [[Stochastic Gradient Descent|SGD]] for parameter updates.

## Entities touched

*(None — this chapter is conceptual, not about specific organizations or artifacts.)*

## Topics touched

[[Pretraining]], [[Transfer Learning]], [[Fine-tuning]], [[Backpropagation]], [[Stochastic Gradient Descent]]

## Open questions

- The chapter motivates pretraining via 4 problems; are these independent or does scale (data + params) collapse them into one?
- "Interpretability via learned abstractions" is a weak claim — modern LLMs are not especially interpretable. Is this chapter stale, or is it pointing at a specific narrow kind of interpretability (e.g., word embeddings)?
- Where does this chapter place data quality in the picture? The text emphasizes *volume*; modern practice emphasizes *quality + volume*.

## Raw source

- Lark wiki node: https://my.feishu.cn/wiki/MoGHwoPFeiDsj9ksdSxcST6mnEI
- Space 1 "Hirono Raw" · 大语言模型知识库 · Chapter 3
- Fetched via `lark-hirono fetch --doc MoGHwoPFeiDsj9ksdSxcST6mnEI` on 2026-04-19 (~20 lines; introductory section)
- Language: Chinese; summarized here in English per wiki convention
