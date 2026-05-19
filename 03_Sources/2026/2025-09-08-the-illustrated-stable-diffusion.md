---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://jalammar.github.io/illustrated-stable-diffusion/
tags: [training, inference, paper]
---

# [2022-10-04] The Illustrated Stable Diffusion

## TL;DR

A visual explainer of the Stable Diffusion architecture by Jay Alammar, covering the three main components (ClipText encoder, UNet+Scheduler, Autoencoder Decoder), the latent-space diffusion process, and how text conditioning is incorporated via cross-attention layers inside the UNet.

## Key claims

- Stable Diffusion has three neural networks: ClipText (text encoder producing 77×768 token embeddings), UNet+Scheduler (iterative noise predictor in latent space, default 50–100 steps), and Autoencoder Decoder (single-pass image decoder from a (4,64,64) latent to a (3,512,512) pixel image).
- Running diffusion in latent space (4× compressed via autoencoder) is the key speed advantage over pixel-space diffusion models like DALL-E 2 and Imagen, which share the same UNet denoising concept.
- Training uses noise augmentation: a clean image + added Gaussian noise (parameterized noise amount) → noise predictor learns to subtract the noise slice; training over many noise levels per image from a large aesthetic dataset (LAION Aesthetics).
- Text conditioning is injected via cross-attention layers between ResNet blocks in the UNet; the ResNet blocks themselves do not directly attend to text, but the attention layers merge text token embeddings into the latent representation for subsequent ResNet processing.
- The choice of text encoder significantly impacts generation quality: larger language models improve output more than larger image generation components (per Google Imagen paper Fig. A.5); early SD used 63M-parameter ClipText; SD V2 upgraded to OpenCLIP variants up to 354M parameters.
- CLIP is trained on 400M image-caption pairs with contrastive loss (cosine similarity between image and text embeddings, with negative pairs); the resulting embeddings make a dog image and "a picture of a dog" similar in embedding space.

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/jalammar.github.io/2025-09-08-the-illustrated-stable-diffusion/default-img-007.png)
![](https://hirono-wiki.litenext.digital/raindrop/jalammar.github.io/2025-09-08-the-illustrated-stable-diffusion/default-img-031.png)
![](https://hirono-wiki.litenext.digital/raindrop/jalammar.github.io/2025-09-08-the-illustrated-stable-diffusion/default-img-033.png)
![](https://hirono-wiki.litenext.digital/raindrop/jalammar.github.io/2025-09-08-the-illustrated-stable-diffusion/default-img-019.png)

*Other images decorative (intermediate diffusion step visualizations, dataset illustration, CLIP training diagram).*

## Entities touched

[[Stable Diffusion]]

## Topics touched

[[LLM Architectures]]

## Raw source

[jalammar.github.io/illustrated-stable-diffusion/](https://jalammar.github.io/illustrated-stable-diffusion/) — blog post by Jay Alammar, published 2022-10-04, V2 updated Nov 2022. Read 2026-05-16.
