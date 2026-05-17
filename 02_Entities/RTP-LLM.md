---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 12
tier: active
---

# RTP-LLM

Alibaba's high-performance LLM inference engine; basis for RTPurbo attention compression work

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- RTPurbo（阿里巴巴[[RTP-LLM]]团队）后训练压缩方案：识别约15%关键"长程头"保留全局注意力，其余截断远程注意力，实现5倍Attention计算压缩；通过"自蒸馏"训练仅需小时级微调+约1万条数据，压缩后Qwen3-480B在长文本任务上表现与原模型持平。 — [[2026-01-14-直播预告-rtpurbo-小时级训练实现qwen3-480b模型5x-atten]]
- Alibaba team's RTP-LLM reproduced [[DeepSeek-V3]] inference at Prefill 42.6K TPS/node and Decode 14.7K TPS/node on Alibaba Cloud RoCE (272 GPUs, EP=32/144, TP=1); techniques: [[DeepEP]] integration with RoCE dual-uplink fix (Low Latency latency -60%+), full MicroBatch overlap, MTP speculative decoding, PDL-enabled GEMM+Quantization overlap; remaining gaps vs DeepSeek: Prefill Attention and Decode Quantization kernel speeds. — [[2025-10-09-如何重现-deepseek-推理性能突破]]
