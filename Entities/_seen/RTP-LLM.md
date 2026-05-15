---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# RTP-LLM

Alibaba's high-performance LLM inference engine; basis for RTPurbo attention compression work

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- RTPurbo（阿里巴巴[[RTP-LLM]]团队）后训练压缩方案：识别约15%关键"长程头"保留全局注意力，其余截断远程注意力，实现5倍Attention计算压缩；通过"自蒸馏"训练仅需小时级微调+约1万条数据，压缩后Qwen3-480B在长文本任务上表现与原模型持平。 — [[2026-01-14-直播预告-rtpurbo-小时级训练实现qwen3-480b模型5x-atten]]
