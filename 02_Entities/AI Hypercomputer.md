---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 6
tier: active
---

# AI Hypercomputer

Google's vertically-integrated AI infrastructure architecture (TPU + Jupiter fabric + XLA / JAX / Pathways).

## Observations

- OS/Docker image stack (Jan 2026 reference): three categories — (1) JAX AI Images (JAII): Docker images with JAX + LibTPU or CUDA/NGC DL + Flax + Orbax + Optax + PyGrain + Tensorboard; quarterly release cadence with security-patch revision scheme (rev1 → rev2, minimal change); (2) DLSL Docker images: NeMo + PyTorch + [[Google]] NCCL gIB plugin, per machine series (A4X Max/A4X/A4/A3 Ultra/A3 Mega/A3 High) + MaxText/JAX toolbox variants; (3) Accelerator OS images: Rocky Linux 8/9 and Ubuntu 22.04/24.04 with NVIDIA 570/580 series drivers + CUDA 12.2–13.0. — [[2026-01-16-os-and-docker-images-ai-hypercomputer-go]]
