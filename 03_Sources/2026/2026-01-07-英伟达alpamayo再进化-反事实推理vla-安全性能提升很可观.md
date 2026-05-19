---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/uheAzKubQ37RtOEyfecoPg
tags: [post-training, paper]
---

# [2026-01-07] 英伟达Alpamayo再进化！反事实推理VLA，安全性能提升很可观

## TL;DR

NVIDIA、UCLA、Stanford合著CF-VLA（arXiv:2512.24426）：在[[NVIDIA Alpamayo]]（Alpamayo-R1）基础上引入反事实推理机制，让VLA模型在生成最终轨迹前通过"元动作→反事实推理→更新元动作→轨迹"自反思循环修正规划，轨迹准确率提升17.6%，碰撞率降低20.5%。

## Key claims

- CF-VLA核心创新：时间分段元动作（3维×6.4秒规划时域：纵向/横向/车道级）作为动作-语言对齐中间表示，配合"rollout-筛选-标注"数据流水线，从基础VLA的rollout结果中自动挖掘反事实训练样本。
- 数据规模：纯轨迹集约1160万个20秒视频片段；元动作集43.3万个20秒片段+80.1万个8.4秒样本；反事实推理集约20万样本；教师模型采用[[Qwen]] 2.5-VL-72B-Instruct标注反事实轨迹。
- 实验数据集：来自25个国家80,000小时人类驾驶数据，覆盖高速公路/城市/不同天气/昼夜，在此基础上自动标注3,000小时构建元动作子集。
- 性能阶梯：纯轨迹模型 < meta-act < lang-meta-act < CF-VLA（第一轮）< CF-VLA（第二轮）；无路线场景第二轮CF-VLA比meta-act MinADE/MinFDE降低约9-10%。
- 安全指标：最优CF模型碰撞率降低约25-30%、偏离道路率降低约15-20%、角点距离降低约30%（vs. 纯轨迹基线）。
- 自适应推理：CF-VLA在有路线场景以低于0.25的推理率（Think Rate）超越全程推理的lang-meta-act；第二轮训练后推理率进一步降低约40-45%，计算开销优化同时性能提升。
- 关键消融：数据筛选（基于轨迹差异准则）对性能至关重要——全数据集生成反事实轨迹引入噪声，导致推理率达0.67但性能反而下降（筛选后仅0.22）。
- 架构与[[NVIDIA Alpamayo]] R1相似：广角(120°)+长焦(30°)双路视频输入（2Hz，过去2秒），离散轨迹令牌输出，扩展VLM词汇表容纳轨迹token。

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-01-07-英伟达alpamayo再进化-反事实推理vla-安全性能提升很可观/weixin-img-002.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-01-07-英伟达alpamayo再进化-反事实推理vla-安全性能提升很可观/weixin-img-003.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-01-07-英伟达alpamayo再进化-反事实推理vla-安全性能提升很可观/weixin-img-006.png)

*Other images decorative — promotional materials, community QR codes, course ads.*

## Entities touched

[[NVIDIA Alpamayo]], [[VLA]], [[Qwen]], [[NVIDIA]]

## Topics touched

[[VLA for Autonomous Driving]], [[RL Post-Training]]

## Raw source

[mp.weixin.qq.com/s/uheAzKubQ37RtOEyfecoPg](https://mp.weixin.qq.com/s/uheAzKubQ37RtOEyfecoPg) — 公众号 自动驾驶之心，2026-01-07；原论文 arXiv:2512.24426. Read 2026-05-15.
