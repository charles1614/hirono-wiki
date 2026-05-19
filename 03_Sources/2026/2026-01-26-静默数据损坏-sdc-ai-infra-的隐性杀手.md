---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/_tlHqVmHjul8XvUvd0OQOg
tags: [training, gpu, pretraining]
---

# [2026-01-25] 静默数据损坏（SDC）：AI Infra 的隐性杀手

## TL;DR

A thorough survey of Silent Data Corruption (SDC) in LLM training infrastructure, grounded in the paper "Understanding Silent Data Corruption in LLM Training" (arXiv:2502.12340). The article classifies SDC root causes (permanent vs. transient faults), documents production incidents from Google Gemini, Meta LLaMA 3, ByteDance, and Meituan, and presents a three-level experimental methodology isolating SDC effects on submodule computation, gradient quality, and training convergence across 15 unhealthy nodes.

## Key claims

- SDC is the class of hardware fault that evades all detection mechanisms (ECC, parity) and silently corrupts compute results; distinct from Detected Unrecoverable Errors (DUE) and ECC-corrected benign faults. On NVIDIA GPUs: Xid 94 = contained ECC error (affects only the triggering process); Xid 95 = uncontained (affects all processes on the GPU). [[NVIDIA]] [[H100]]
- Root causes: (1) permanent faults — small-delay defects from manufacturing variance/aging, stuck-at faults, intermittent faults triggered by aggressive voltage/frequency; (2) transient faults — single-event upsets from cosmic rays or alpha particles hitting register files and arithmetic units, worsened by the higher fraction of die area given to ALUs in AI accelerators. [[NVIDIA]]
- Production SDC incidents: Google Gemini experienced an SDC event every 1–2 weeks during training; Meta LLaMA 3 had 6 SDC-caused interruptions over 54 days of pretraining; ByteDance required 8 hours of offline stress testing to identify one faulty node; Meituan (Longcat) found FlashAttention backward gradients specifically sensitive to SDC. [[Meta]] [[Google]] [[FlashAttention]]
- NVIDIA H100 shipped with an `mma.sp` (sparsity instruction) bug causing intermittent SDC; fixed via driver update 535.288.01. [[H100]] [[NVIDIA]]
- Experimental methodology: 15 unhealthy + 15 healthy nodes; two sync mechanisms — computation sync (lock-step TP-rank pairs, overwrite unhealthy outputs after each submodule to isolate cumulative error) and parameter sync (broadcast healthy parameters at end of each optimizer step). [[NVIDIA]]
- RQ1 result: SDC mismatch frequency varies widely across nodes; Node 10 and Node 11 show high mismatch frequency while Node 2 and Node 3 show none; mismatch is non-uniform in time (high variance across steps). Worst-case mismatch severity >100 on Node 9 (completely different TP results on affected microsteps).
- RQ2 result: Gradient noise from SDC is relatively small — worst case (Node 11) gradient L2 diff is 5.1% of true gradient magnitude, suggesting SDC does not catastrophically corrupt per-step gradients.
- RQ3 result: Despite similar training loss curves, model parameters on unhealthy nodes gradually diverge from healthy nodes, converging to different local minima; the divergence rate is driven more by sharp loss surface geometry than by SDC frequency or severity. SFT on SDC nodes mostly preserves downstream task performance, but late-stage loss spikes (Node 6 on CosmosQA) can cause catastrophic accuracy collapse.
- Mitigation categories: spatial redundancy (hardware/compute replication), temporal redundancy (repeated execution), information redundancy (checksums, ECC); recovery is either backward (checkpoint rollback) or forward (in-place correction).

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-01-26-静默数据损坏-sdc-ai-infra-的隐性杀手/weixin-img-002.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-01-26-静默数据损坏-sdc-ai-infra-的隐性杀手/weixin-img-003.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-01-26-静默数据损坏-sdc-ai-infra-的隐性杀手/weixin-img-004.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-01-26-静默数据损坏-sdc-ai-infra-的隐性杀手/weixin-img-019.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-01-26-静默数据损坏-sdc-ai-infra-的隐性杀手/weixin-img-020.png)

*Other images decorative — formula screenshots (weixin-img-009 to 012, 017), node-collection flowchart (007), mismatch frequency / severity tables (013–016, 018), SDC classification diagram (001), NVIDIA driver release note screenshot (006).*

## Entities touched

[[NVIDIA]], [[H100]], [[Meta]], [[Google]], [[FlashAttention]]

## Topics touched

[[Hardware Reliability]], [[Training Infrastructure]], [[LLM Training Systems]]

## Raw source

[mp.weixin.qq.com/s/_tlHqVmHjul8XvUvd0OQOg](https://mp.weixin.qq.com/s/_tlHqVmHjul8XvUvd0OQOg) — WeChat public account "AI闲谈", published 2026-01-25, 21 images downloaded, raw-HTML pipeline. Read 2026-05-15.
