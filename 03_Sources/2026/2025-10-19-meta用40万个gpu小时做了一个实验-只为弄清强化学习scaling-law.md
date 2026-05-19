---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/DPuKGb0DsJYids-dUVOl_Q
tags: [post-training, scaling-law, gpu]
---

# [2025-10-19] Meta用40万个GPU小时做了一个实验，只为弄清强化学习Scaling Law

## TL;DR

Meta researchers spent 400K GPU-hours on NVIDIA GB200s to derive a predictive framework for RL compute scaling in LLMs. The resulting recipe, [[ScaleRL]], models RL performance as a sigmoid-saturating curve over compute and achieves predictable, consistently improving results across multiple scaling dimensions.

## Key claims

- A sigmoid-style saturation curve `R_C = A · sigmoid(B · log(C/C_mid))` relates expected reward to training compute; fitting it at 50% budget allows accurate extrapolation to full budget.
- Three principles emerged from 400K GPU-hours of ablations: (1) asymptotic performance ceiling A varies by method and is tunable; (2) methods excellent at small compute may underperform at scale ("bitter lesson"); (3) common tricks (loss aggregation, data curriculum, length penalty, advantage normalization) primarily affect efficiency B not ceiling A.
- [[ScaleRL]] integrates: async PipelineRL-8 (off-policyness k=8), CISPO loss (truncated importance-sampling REINFORCE), FP32 logits, prompt-level loss averaging, batch-level advantage normalization, zero-variance filtering, and No-Positive-Resampling.
- In a 100K GPU-hour validation on Llama-4 Scout 17B×16 MoE, ScaleRL curves fit the predictive framework and achieved far higher asymptotic performance than the 8B dense baseline while using 1/6th the RL compute.
- Larger batch sizes (up to 2048 prompts) and longer context (14k→32k tokens) both raise the ceiling A; longer context lowers efficiency B but the performance gain materializes with sufficient compute.

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-10-19-meta用40万个gpu小时做了一个实验-只为弄清强化学习scaling-law/weixin-img-003.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-10-19-meta用40万个gpu小时做了一个实验-只为弄清强化学习scaling-law/weixin-img-005.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-10-19-meta用40万个gpu小时做了一个实验-只为弄清强化学习scaling-law/weixin-img-015.png)

*Other images decorative — experimental curves already described in body text.*

## What this changes

The framework enables researchers to predict RL method scalability from small pilot runs, lowering the entry barrier for academic groups priced out of large-scale RL experiments.

## Entities touched

[[Meta]], [[ScaleRL]], [[Llama]]

## Topics touched

[[RL Post-Training]], [[Scaling Laws]], [[LLM Training Systems]]

## Raw source

[mp.weixin.qq.com/s/DPuKGb0DsJYids-dUVOl_Q](https://mp.weixin.qq.com/s/DPuKGb0DsJYids-dUVOl_Q) — 机器之心 WeChat article summarizing arXiv:2510.13786, published 2025-10-19. Read 2026-05-15.
