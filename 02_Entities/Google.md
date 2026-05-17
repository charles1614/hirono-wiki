---
created: 2026-05-11
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 19
tier: active
---

# Google

Tech company; AI lab (DeepMind); TPU silicon vendor; Pathways runtime; competitor to OpenAI/Anthropic/Meta.

## Synthesis



Google's TPU lineage runs from v5e through Ironwood (v7), with Epoch.ai placing Ironwood at 4.61 PFLOP/s FP8 / 7.37 TB/s / 192 GB / 960 W as the latest generation (FP8 native support first appearing at Trillium/v6e in May 2024). Ironwood was announced at Google Cloud Next '25 as the first inference-first TPU, framing the "age of inference" pivot (proactive agents, real-time response) as the architectural forcing function — 9,216-chip pod at 42.5 EFLOPS / ~10 MW with 2× perf/watt over Trillium and ~30× over TPU v2. Google operates the most geographically diversified frontier AI campus footprint in Epoch.ai's 43-site database — six US sites (Columbus OH 215k H100-eq, New Albany OH 207k, Omaha NE 136k, Council Bluffs IA East 92k, Storey County NV 89k, Pryor OK 18k) plus international, all attributed to Google DeepMind. The major TPU externalization push includes a 1M Ironwood deal with Anthropic ($52B combined direct + GCP rental) and additional 00_Meta/SSI/xAI/OpenAI targets via a hyperscaler-backstop financing model enabling Neocloud operators to hold DC capacity; GCP CEO Thomas Kurian drove negotiations. Gemini 3 trained and served entirely on TPUs, with all-in Ironwood TCO ~44% lower than Blackwell GB200 from Google's procurement perspective — though critical software remains closed-source (XLA:TPU compiler, TPU runtime, MegaScale multi-pod codebase), with the PyTorch TPU backend RFC #9684 underway to unlock non-JAX users. During Gemini training Google experienced an SDC event approximately every 1–2 weeks, contributing to the corpus evidence that SDC is endemic to frontier-scale clusters rather than a manufacturing anomaly.



## Observations

- Epoch.ai dataset covers the full TPU lineage v5e through Ironwood (v7), confirming [[Ironwood]]'s 4.61 PFLOP/s FP8 / 7.37 TB/s / 192 GB / 960 W as the latest generation — highest memory and bandwidth of any Google chip; FP8 native support first appears at Trillium (v6e, May 2024). — [[2026-01-22-data-on-machine-learning-hardware]]
- Announced [[Ironwood]] (TPU v7) at Google Cloud Next '25 as the first inference-first TPU; framed the "age of inference" pivot (proactive agents vs real-time response) as the architectural forcing function; 9,216-chip pod at 42.5 EFLOPS / ~10 MW; 2× perf/watt over [[Trillium]], ~30× over TPU v2. [[Pathways]] and AI Hypercomputer stack compose hundreds of thousands of chips across pods. — [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]
- Operates the most geographically diversified frontier AI campus footprint in Epoch.ai's 43-site database: six US sites (Columbus OH 215k H100-eq, New Albany OH 207k, Omaha NE 136k, Council Bluffs IA East 92k, Storey County NV 89k, Pryor OK 18k) plus international; all attributed to Google DeepMind as tenant. Power estimates derived from cooling-tower satellite imagery and transmission-permit disclosures. — [[2026-01-22-data-on-frontier-ai-data-centers]]
- Executing major [[TPU]] externalization: [[Anthropic]] 1M [[Ironwood]] deal ($52B combined direct + GCP rental), 00_Meta/SSI/xAI/OpenAI targeted as additional customers; "hyperscaler backstop" financing model (off-balance-sheet IOU) enables Neocloud operators to hold DC capacity. GCP CEO Thomas Kurian drove negotiations; Google holds a capped 15% non-voting equity in Anthropic. — [[2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro]]
- During Gemini training, Google experienced an SDC event approximately every 1–2 weeks that affected training; the survey (arXiv:2502.12340) references this as evidence that SDC is endemic to frontier-scale GPU clusters, not a manufacturing defect anomaly. — [[2026-01-26-静默数据损坏-sdc-ai-infra-的隐性杀手]]
- Gemini 3 trained and served entirely on TPUs — the existence proof for frontier-scale TPU parity. All-in Ironwood TCO is ~44% lower than [[Blackwell]] GB200 from Google's procurement perspective. Critical software gap remaining: XLA:TPU compiler, TPU runtime, and MegaScale multi-pod codebase are closed-source. Native PyTorch TPU backend (RFC #9684) underway to unlock non-JAX users. — [[2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro]]
- [[AI Hypercomputer]] image stack (Jan 2026): JAX AI Images (JAII) bundle JAX, LibTPU/CUDA, Flax, Orbax, Optax, PyGrain, Tensorboard per versioned Docker image for TPU or GPU; DLSL images bundle NeMo + PyTorch + Google NCCL gIB plugin per machine series (A4X Max through A3 High); Accelerator OS images ship NVIDIA 570/580 drivers + CUDA 12.2–13.0 for Rocky Linux 8/9 and Ubuntu 22.04/24.04. A4X Max blueprint uses CUDA 13.0 + Arm architecture. — [[2026-01-16-os-and-docker-images-ai-hypercomputer-go]]
