---
created: 2026-05-15
updated: 2026-05-15
type: topic
source_count: 2
---

# Hardware Reliability

## What

Silent data corruption, ECC, fault tolerance, and reliability mechanisms in AI accelerators and GPU clusters

## Current understanding

_(stub — populate as sources accumulate. `topic-content-gaps` will lint-warn once source_count ≥ 3.)_

## Open threads

## Observations

- SDC classification: benign fault (ECC-corrected silently) → DUE (detected but unrecoverable, system stops) → SDC (escapes all detection, corrupts output silently). Root causes: permanent faults (stuck-at, intermittent, small-delay defects from aggressive voltage/frequency; manufacturing variance); transient faults (cosmic-ray neutrons, alpha particles hitting register files and ALU buffers). AI accelerators are more exposed than CPUs because a larger fraction of die area is given to arithmetic units. Paper arXiv:2502.12340 provides a rigorous 15+15 healthy/unhealthy node experimental framework. — [[2026-01-26-静默数据损坏-sdc-ai-infra-的隐性杀手]]
- Xid error taxonomy for large GPU clusters: Xid 79 (GPU fallen off PCIe bus) co-occurs with PCIe errors in 43–63% of cases across Meta RSC-1/RSC-2; Xid 31 (illegal memory access) is mostly user-program error but can be driver/hardware bug; NVLink errors account for 42.57% of all Xids in DeepSeek Fire-Flyer cluster; Xid 45+74 cascade from fatal NVSwitch SXid events. At 8-GPU servers with 0.1% daily per-GPU failure rate, a 10,000-GPU cluster has 99.99% probability of at least one GPU failure per day. — [[2025-08-16-聊聊-gpu-监控那些事-利用率-故障等]]
- Lemon node identification at Meta: 40 nodes out of 2,000 A100 (RSC-1, 1.2%) were responsible for 13% of daily job failures; detection via per-node job failure rate histogram; eviction cut large-job (512+ GPU) failure rate from 14% to 4%. Memory row remap (`DCGM_FI_DEV_ROW_REMAP_PENDING`) can cause silent loss divergence; requires DCGM level-3 diagnostic with exclusive access. — [[2025-08-16-聊聊-gpu-监控那些事-利用率-故障等]]
- Meta LLaMA 3 405B pretraining on 16,384 H100 GPUs (54 days): 466 job interruptions total — 47 planned + 419 unexpected; 78% of unexpected interruptions from hardware failures; GPU issues: 58.7% of hardware failures; only 3 required human intervention due to automated ops tooling; theoretical training time ~42.3 days vs actual 54 days, gap attributable partly to hardware-driven restarts. — [[2025-08-16-聊聊-gpu-监控那些事-利用率-故障等]]

## Sources drawn on

_(populated as Sources wikilink this Topic; cite each with one-line relevance.)_
