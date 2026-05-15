---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/lPTJQZFzu-mA_cwJt-f8qw
tags: [inference, speculative-decoding, tooling, announcement]
---

# [2026-01-13] 腾讯AngelSlim重磅升级：面向全模态的大模型压缩算法工具包，推理速度飙升1.8倍

## TL;DR

腾讯混元AngelSlim v2升级，基于Eagle3投机采样训练范式构建系统化实现，支持LLM、视觉语言模型（VLM）和语音（ASR/TTS）全模态投机采样草稿模型训练，实际部署最高可达1.9×推理加速，训练产出模型可直接用于vLLM/SGLang部署。

## Key claims

- AngelSlim以"Eagle3训练即部署"为核心设计，提供从数据处理、模型封装到投机采样算法训练的完整链路，各模态加速倍率1.4-1.9×；设置`num_speculative_tokens=2 or 4`时，接收长度可达1.8-3.5。
- 架构三层：数据处理模块（重采样、多模态token标准化、隐藏特征提取）、统一TargetModel接口（支持低成本扩展新模型后端）、训练器模块（在线/离线两种训练模式，Eagle3关键逻辑封装含training-time-test，支持断点续训）。
- 在线训练（small model or充足显存）vs 离线训练（大模型/低显存高磁盘）二选一；草稿模型参数+Optimizer/LR Scheduler状态完整保存恢复。
- Eagle3训练-时-测试（training-time-test）：训练时模拟Eagle3多步生成，让草稿模型学习使用自己的预测，提升接收率。
- 已开源：GitHub `Tencent/AngelSlim`，HuggingFace `AngelSlim/eagle3` collections提供预训练权重。
- 未来计划：支持vLLM离线hidden states生成降低数据构建成本；探索多模态理解+语音输入在Eagle3中的深度融合，统一建模文本/视觉/语音特征。

## Visual observations

![](../../raw/raindrop/mp.weixin.qq.com/2026-01-13-腾讯angelslim重磅升级-面向全模态的大模型压缩算法工具包-推理速度飙升-/weixin-img-003.png)
![](../../raw/raindrop/mp.weixin.qq.com/2026-01-13-腾讯angelslim重磅升级-面向全模态的大模型压缩算法工具包-推理速度飙升-/weixin-img-007.png)

*Other images decorative — GIFs and component diagrams redundant with body text.*

## What this changes

AngelSlim将Eagle3投机采样从单LLM扩展至全模态，并提供开箱即用的vLLM/SGLang部署兼容性，降低多模态推理加速的工程门槛。

## Entities touched

[[AngelSlim]], [[EAGLE-3]], [[vLLM]], [[SGLang]]

## Topics touched

[[Speculative Decoding]]

## Raw source

[mp.weixin.qq.com/s/lPTJQZFzu-mA_cwJt-f8qw](https://mp.weixin.qq.com/s/lPTJQZFzu-mA_cwJt-f8qw) — WeChat公众号 腾讯技术工程，2026-01-13. Read 2026-05-15.
