---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://blog.cnbang.net/tech/3823/
tags: [training, attention-kernels, minimal-impl]
---

# [2024-05-26] 理解 Stable Diffusion UNet 网络

## TL;DR

深度科普 Stable Diffusion UNet 的内部结构：从原始 UNet 的下采样/上采样/跳跃连接，到 SD 改造引入的 ResnetBlock 和 Transformer 模块（自注意力 + 交叉注意力），解释 prompt embedding 与噪声图在各模块间的流转。

## Key claims

- SD UNet 占 SD 1.5 模型总参数的 80%（859M，3.44 GB），是生图核心网络；CLIP 占 12%，VAE 占 8%。
- 原始 UNet（用于医学图像分割）通过下采样→最小特征→上采样结构捕捉语义，跳跃连接（skip connection）将每层下采样的细节拼接到对应上采样层，弥补上采样过程中丢失的图像细节。
- SD UNet 在每个下采样层引入 2 个 ResnetBlock + 2 个 Transformer 模块（上采样层各 3 个），ResnetBlock 接收噪声图+时间步嵌入，Transformer 模块中的交叉注意力（CrossAttention）接收 Q=图像特征、K/V=prompt_embedding，实现文本条件图像生成。
- 自注意力模块（SelfAttention）的 QKV 全部来自图像特征，捕捉图片不同位置间的关系；交叉注意力模块仅在此处融合文本 prompt，prompt 只在 Transformer 模块的 CrossAttention 中起作用。
- 最高维（d4/u1）的下采样/上采样层未接入 Transformer 模块，推测在最高维加入 prompt 交叉注意力权重过大效果不佳。

## Visual observations

![](../../raw/raindrop/blog.cnbang.net/2025-09-08-理解-stable-diffusion-unet-网络-bang-s-blog/default-img-002.png)

![](../../raw/raindrop/blog.cnbang.net/2025-09-08-理解-stable-diffusion-unet-网络-bang-s-blog/default-img-003.png)

![](../../raw/raindrop/blog.cnbang.net/2025-09-08-理解-stable-diffusion-unet-网络-bang-s-blog/default-img-005.png)

*Other images decorative — original UNet architecture overview and full model schematic already captured above.*

## Entities touched

[[Stable Diffusion]], [[UNet]], [[FlashAttention]]

## Topics touched

[[Attention Kernels]], [[LLM Architectures]]

## Raw source

[blog.cnbang.net/tech/3823/](https://blog.cnbang.net/tech/3823/) — bang's blog (个人博客), 2024-05-26. Read 2026-05-15.
