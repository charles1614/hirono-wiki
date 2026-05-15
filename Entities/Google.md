---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 10
tier: active
---

# Google

Tech company; AI lab (DeepMind); TPU silicon vendor; Pathways runtime; competitor to OpenAI/Anthropic/Meta.

## Synthesis

*Regenerated from Observations below.*

## Observations

- Epoch.ai dataset covers the full TPU lineage v5e through Ironwood (v7), confirming [[Ironwood]]'s 4.61 PFLOP/s FP8 / 7.37 TB/s / 192 GB / 960 W as the latest generation — highest memory and bandwidth of any Google chip; FP8 native support first appears at Trillium (v6e, May 2024). — [[2026-01-22-data-on-machine-learning-hardware]]
- Announced [[Ironwood]] (TPU v7) at Google Cloud Next '25 as the first inference-first TPU; framed the "age of inference" pivot (proactive agents vs real-time response) as the architectural forcing function; 9,216-chip pod at 42.5 EFLOPS / ~10 MW; 2× perf/watt over [[Trillium]], ~30× over TPU v2. [[Pathways]] and AI Hypercomputer stack compose hundreds of thousands of chips across pods. — [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]
- Operates the most geographically diversified frontier AI campus footprint in Epoch.ai's 43-site database: six US sites (Columbus OH 215k H100-eq, New Albany OH 207k, Omaha NE 136k, Council Bluffs IA East 92k, Storey County NV 89k, Pryor OK 18k) plus international; all attributed to Google DeepMind as tenant. Power estimates derived from cooling-tower satellite imagery and transmission-permit disclosures. — [[2026-01-22-data-on-frontier-ai-data-centers]]
- Executing major [[TPU]] externalization: [[Anthropic]] 1M [[Ironwood]] deal ($52B combined direct + GCP rental), Meta/SSI/xAI/OpenAI targeted as additional customers; "hyperscaler backstop" financing model (off-balance-sheet IOU) enables Neocloud operators to hold DC capacity. GCP CEO Thomas Kurian drove negotiations; Google holds a capped 15% non-voting equity in Anthropic. — [[2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro]]
- Gemini 3 trained and served entirely on TPUs — the existence proof for frontier-scale TPU parity. All-in Ironwood TCO is ~44% lower than [[Blackwell]] GB200 from Google's procurement perspective. Critical software gap remaining: XLA:TPU compiler, TPU runtime, and MegaScale multi-pod codebase are closed-source. Native PyTorch TPU backend (RFC #9684) underway to unlock non-JAX users. — [[2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro]]
