---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://docs.cloud.google.com/ai-hypercomputer/docs/images#tpu-images
tags: [training, inference, tpu, gpu, production-deployment]
---

# [2026-01-16] OS and Docker Images for Google AI Hypercomputer

## TL;DR

Google Cloud's AI Hypercomputer provides three image categories: JAX AI Images (Docker, pre-configured with JAX + TPU/GPU libraries), Deep Learning Software Layer (DLSL) Docker images (PyTorch/NeMo + NCCL plugins for GPU clusters), and Accelerator OS images (Rocky Linux / Ubuntu with NVIDIA drivers for bare-instance deployment). The most recent JAX AI TPU image is JAX 0.9.0 (rev1, 2026-02-03); GPU images go up to JAX 0.7.2 with CUDA DL 25.06.

## Key claims

- **JAX AI Images (JAII)** combine JAX, LibTPU/CUDA, Flax, Orbax, Optax, PyGrain, and Tensorboard into a single versioned Docker image for TPUs or GPUs; built quarterly with a goal of syncing to every JAX release.
- TPU image stack includes Qwix (quantization), Tokamax (custom kernels), and Cloud Accelerator Diagnostics; GPU image stack adds TransformerEngine (NVIDIA) on top of the NGC CUDA DL base image.
- **DLSL images** bundle NeMo + PyTorch + Google's NCCL gIB plugin; machine-series–specific variants cover A4X Max, A4X, A4, A3 Ultra, A3 Mega, A3 High (GPUDirect-TCPX for A3 Mega/High).
- **Accelerator OS images** ship pre-installed NVIDIA drivers (570/580 series), CUDA Toolkit (12.2–13.0), Infiniband/NCCL stack, and Cloud Storage FUSE — available for Rocky Linux 8/9 and Ubuntu 22.04/24.04, covering both x86 and Arm (A4X, A4X Max).
- Revision policy: a security or breaking-change fix results in a new revision (e.g., JAX-0.4.30-rev1 → rev2) with all other packages pinned; this is the minimal-change contract.
- A4X Max blueprint uses Ubuntu 24.04, Slurm 25.05.2, CUDA 13.0, and `nccl-gib-a4x-max-arm64`; A4 uses CUDA 12.8 and Infiniband `ibverbs-utils`.

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## What this changes

- Provides a reference for [[AI Hypercomputer]] image selection when deploying JAX or PyTorch workloads on GKE/Slurm/Compute Engine in 2026.

## Entities touched

[[AI Hypercomputer]], [[JAX]], [[Google]]

## Topics touched

[[Training Infrastructure]], [[LLM Training Systems]]

## Raw source

[docs.cloud.google.com/ai-hypercomputer/docs/images](https://docs.cloud.google.com/ai-hypercomputer/docs/images#tpu-images) — Google Cloud official documentation, captured 2026-01-16. Read 2026-05-15.
