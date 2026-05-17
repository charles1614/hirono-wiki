---
created: 2026-05-15
updated: 2026-05-16
type: entity
refs: 2
tier: seen
---

# Stable Diffusion

text-to-image diffusion model architecture based on latent diffusion

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- SD 1.5 模型三组件参数分布：CLIP 123M（492 MB，12%）/ VAE 84M（335 MB，8%）/ UNet 860M（3.44 GB，80%）；UNet 是生图核心，占模型总体积绝大部分。 — [[2025-09-08-理解-stable-diffusion-unet-网络-bang-s-blog]]
- Stable Diffusion's three-component architecture: ClipText encoder (77 × 768 token embeddings); UNet+Scheduler noise predictor in latent space (default 50–100 denoising steps); Autoencoder Decoder (4,64,64 latent → 3,512,512 pixel image); key insight is latent-space diffusion providing ~4× speed advantage over pixel-space diffusion; text conditioning via cross-attention layers between UNet ResNet blocks. — [[2025-09-08-the-illustrated-stable-diffusion]]
- Larger text encoders improve Stable Diffusion output quality more than larger image generation components (per Imagen paper Fig A.5); SD V1 used OpenAI's 63M-parameter ClipText; SD V2 upgraded to OpenCLIP variants up to 354M parameters. — [[2025-09-08-the-illustrated-stable-diffusion]]
