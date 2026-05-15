---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# UNet

encoder-decoder convolutional network with skip connections, core of diffusion model denoising

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- SD UNet 每个下采样层由 2 个 ResnetBlock + 2 个 Transformer 模块组成（上采样层各 3 个）；Transformer 模块中 CrossAttention 以 Q=图像特征、K/V=prompt_embedding 实现文本条件控制；SelfAttention QKV 全来自图像特征捕捉全局感受野；最高维（d4/u1）层未接入 Transformer 模块。 — [[2025-09-08-理解-stable-diffusion-unet-网络-bang-s-blog]]
