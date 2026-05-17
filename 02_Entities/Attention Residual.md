---
created: 2026-05-15
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 8
tier: active
---

# Attention Residual

architectural mechanism — cross-layer attention over historical block representations

## Synthesis



Attention Residual (AttnRes) is the architectural innovation behind Kimi K2's near-zero-inference-overhead inter-layer attention, replacing standard equal-weight residual sums with a learned weighted sum across all previous layers — two constraints make it tractable: non-negative weights (same-direction contributions) and weight normalization (lossless via RMSNorm scale-invariance). Su Jianlin's first-person account frames the design as more radical than Hyper-Connections or mHC — those expand residual flow, while AttnRes replaces it; the Hyper-Connections variant (DeepSeek mHC) is shown to be a special case of inter-layer attention, validating AttnRes as the more principled general route. Block AttnRes is Moonshot's engineering compromise under inference-latency hard constraints and training cross-PP communication limits: query and hidden state per layer are decoupled into learnable parameters, enabling batch precomputation of inter-block attention across all layers in a block (two-phase computation), compressing per-layer extra memory access to ~2.5D versus baseline 4D and measuring <2% decode latency overhead. Full AttnRes was shown feasible at inference via two-phase computation (memory access O(L) → O(√L), VRAM ~2 GB/card after TP sharding at 128K) but training-side cross-PP communication blocked its deployment, with block_num=8 chosen as the joint optimum across training efficiency, algorithm quality, and inference latency on current hardware. The same "progressive dilution" / "progressive representation overwriting" intuition was independently reached by a context-compression paper using residual attention over frozen LLM hidden states to bypass layer dilution.



## Observations

- Block AttnRes 是 [[Moonshot AI]] 在推理延迟硬约束和训练跨 PP 通信限制下对 Full AttnRes 的工程折中版本：每层 attention query 与 hidden state 解耦为可学习参数，使同一 block 内所有层的 inter-block attention 可批量预计算（two-phase computation），将每层额外访存开销压至 ~2.5D（vs baseline 4D），实测 < 2% decode latency。 — [[2026-03-21-https-zhuanlan-zhihu-com-p-2017528295286]]
- Full AttnRes（每层对所有历史层输出做 selective aggregation）在推理侧已通过 two-phase computation 证明可行（访存从 O(L) 优化至 O(√L)，显存按 TP 维度分摊后 ~2 GB/卡），阻碍上线的是训练侧跨 PP 通信问题；block_num=8 是综合训练效率、算法效果、推理开销在当前硬件下的平衡点。 — [[2026-03-21-https-zhuanlan-zhihu-com-p-2017528295286]]
- The same "progressive dilution" / "progressive representation overwriting" intuition behind [[Kimi K2]]'s Attention Residuals was independently reached by a context-compression paper: residual attention over frozen LLM hidden states is used to bypass layer dilution during compression, with the compressor selecting predominantly early-to-middle-layer features, confirming deep layers are unsuitable for compression. — [[2026-03-16-我们撞车了kimi的注意力残差-但用在压缩上-小红书]]
- Kimi's paper "Attention Residuals" cited alongside 苏神's companion post "Attention Residuals回忆录" as recommended reading on direct inter-layer attention as a residual substitute. — [[2026-03-29-周末到-看看最近的论文和技术博客-充充电-小红书]]
- First-person account by Su Jianlin (苏剑林, Moonshot AI): the core insight is that standard residuals are equal-weight sums of all previous states — AttnRes replaces this with a learned weighted sum (inter-layer attention); two constraints make it tractable: non-negative weights (same-direction contributions) and weight-normalization (lossless due to RMSNorm scale-invariance). Hyper-Connections ([[DeepSeek]] mHC) is shown to be a special case of inter-layer attention, validating AttnRes as the more principled general route. — [[2026-03-22-kimi弃用残差连接背后-苏剑林第一视角解析attention-residual]]
