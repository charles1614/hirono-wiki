# ForceInjection/AI-fundermentals: DeepSeek-V3 在 32 张 H20 GPU 集群上的部署方案【理论分析篇】

> 原文链接: https://github.com/ForceInjection/AI-fundermentals/blob/main/inference-solution/DeepSeek-V3-MoE-vLLM-H20-Deployment.md

---

本文根据 `DeepSeek V3 MoE` 模型特点，以及结合 `vLLM` 源码做了一个理论分析，抛砖引玉，供读者讨论！

> **重要更新**: 本文档基于腾讯太极团队在 `DeepSeek-V3` 模型上实现的业内 `H20` 最高性能 `15,800+ tokens/s` 的实际测试数据进行了全面分析和重新评估。腾讯团队在 `16` 卡 `H20` 上通过 `PD` 分离、专家并行优化、量化技术等工程优化实现了显著的性能提升，为我们的 32 卡部署方案提供了重要的实际参考基准。详细分析请参考[腾讯太极团队技术报告](https://mp.weixin.qq.com/s/w_sb_ei-tSGVz9asI9cidQ)。
>
> **免责声明**: 本文档基于 `DeepSeek-V3` 官方技术报告、腾讯太极团队实际测试数据和公开技术规格进行理论分析和部署方案设计。所有性能预期、显存计算和配置建议均为基于实际数据分析的理论评估结果，实际部署性能可能因硬件环境、网络配置、软件版本、工程优化水平等因素而有所差异。建议在实际部署前进行充分的性能测试和验证。

## 1. 项目目标

**目标**：在 **32 张 H20**（4 台 × 8 卡）的集群上，使用 vLLM 部署 **DeepSeek-V3（671B MoE, 37B 激活）**，在**不量化、不蒸馏**前提下，达成如下 `SLO`：

- **并发**：`200` 活跃会话（`continuous batching`）
- **上下文**：`32K tokens`（32,768 tokens，二进制计算，`max model len`）
- **吞吐**：≥ `50,000 tokens/s`（系统级目标），现实预期 **26,860-40,527 tokens/s**（基于腾讯实际数据），建议调整目标至 **30,000-35,000 tokens/s**
- **TTFT**：`P50<0.8s`，`P95<1.2s`，`P99<1.5s`（`512 tokens` 输入）；长输入（4K）TTFT < 2.0s

本文档中所有数值单位均采用**十进制标准**（SI 标准）：

- **存储容量**：GB = 10⁹ bytes，TB = 10¹² bytes
- **带宽**：GB/s = 10⁹ bytes/s，TB/s = 10¹² bytes/s

[ ... 60987 chars total ... ]
