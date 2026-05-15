---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 9
tier: active
---

# Meta

Meta Platforms; AI Research; Llama models; Reality Labs; FAIR; PyTorch maintainer.

## Synthesis

*Regenerated from Observations below.*

## Observations

- MTIA 300 (Mar 2026) is Meta's first public custom AI silicon entry in the Epoch.ai dataset: 600 TFLOP/s FP16 / 1.2 PFLOP/s FP8 / 216 GB memory / 6.1 TB/s BW at 800 W — unusually high memory footprint optimized for inference-at-Meta-scale rather than raw compute density. — [[2026-01-22-data-on-machine-learning-hardware]]
- Epoch.ai frontier data center database: Meta owns and operates Prometheus (New Albany OH, 494k H100-eq / 531 MW / $15.6B — #3 globally), Temple TX (173k / 198 MW / $5.8B), and Hyperion (Richland Parish LA, 0 current compute but permitted for 2.25 GW via Entergy gas turbines + 1.8 GW MISO substation — Meta's next flagship cluster). Prometheus is notable for ad hoc construction spanning a full business park, combining tents, colo, and traditional data center buildings. — [[2026-01-22-data-on-frontier-ai-data-centers]]
- During LLaMA 3 pretraining, SDC caused 6 job interruptions over 54 days; each required identifying and replacing the faulty node before resuming. This is one of four corroborating production incidents (alongside Gemini, ByteDance, Meituan) in a survey paper on SDC impact in LLM training, supporting the case that at-scale SDC is a systemic risk, not an outlier. — [[2026-01-26-静默数据损坏-sdc-ai-infra-的隐性杀手]]
- FT-HSDP (Fault Tolerant HSDP) at 98K GPU scale: 12 DP replicas of 8,192 GPUs each; custom FTAR protocol (CPU control plane + GPU data plane) replaces NCCL for cross-DC gradient AllReduce; 2PC-style barrier before optimizer step allows intentional step-number divergence across replicas; effective training time improved from ~44% to ~80% vs. fully synchronous training. — [[2026-03-01-十万卡保障-meta-ft-hsdp-方案解析]]
- SPDL (Scalable and Performant Data Loading) is a Meta Reality Labs open-source library for ML data pipelines; C++ core (libspdl, ~13k LoC) releases the Python GIL enabling 3–5x throughput and 50–70% lower memory vs multiprocessing; dual thread-pool architecture (I/O pool + compute pool), NVDEC/NVJPEG/NPP hardware acceleration; BSD 2-Clause, arXiv 2504.20067. — [[2026-01-20-deepwiki-spdl-01-overview]]
