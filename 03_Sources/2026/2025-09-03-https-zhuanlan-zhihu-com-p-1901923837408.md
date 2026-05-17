---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://zhuanlan.zhihu.com/p/1901923837408412283?share_code=1ixJdgZB0jvhZ&utm_psn=1946714432546801517
tags: [inference, training, minimal-impl]
---

# [2025-05-03] 大模型的 config.json 中的参数如何决定模型尺寸

## TL;DR

以 Qwen3-32B 为例，逐层推导 `config.json` 中各参数（hidden_size、num_attention_heads、num_key_value_heads、head_dim、intermediate_size、num_hidden_layers、vocab_size）如何决定 Decoder-only LLM 的总参数量，并附 Python 计算代码和 Qwen2.5-32B 对比。

## Key claims

- Qwen3-32B（hidden_size=5120，64 layers，num_attention_heads=64，num_key_value_heads=8，head_dim=128，intermediate_size=25600，vocab_size=151936）总参数量约 32.76B；LM head 权重 = hidden_size × vocab_size = 5120 × 151936。
- GQA 导致 Q/K/V 投影参数量不对称：q_proj = hidden_size × (num_attention_heads × head_dim)，k_proj = v_proj = hidden_size × (num_key_value_heads × head_dim)；Qwen3 额外引入 q_norm 和 k_norm（各 head_dim 参数），对每个 head 归一化。
- MLP 三个线性层（gate_proj / up_proj / down_proj）各占 hidden_size × intermediate_size，是每层参数量的主要贡献（Qwen3-32B 中每层 MLP 约 393M vs Attention 约 94M）。
- Qwen2.5-32B 无显式 `head_dim` 字段（用 hidden_size / num_attention_heads 推导），num_attention_heads=40，intermediate_size=27648，参数量约 32.76B，与 Qwen3-32B 相当，尽管 Qwen3 词表更小、intermediate_size 更小，但 GQA 维度扩展补偿了差距。
- 若 config 中无 `head_dim` 字段，则 head_dim = hidden_size // num_attention_heads；计算公式可推广至 LLaMA、Gemma、Mistral 等使用 Transformers 库规范的模型。

## Visual observations

*No load-bearing images — all panels text-only (typed content extracted into body).*

## Entities touched

[[Qwen]], [[GQA]], [[LLM Architectures]]

## Topics touched

[[LLM Architectures]], [[Minimal-Implementation Pedagogy]]

## Raw source

[zhuanlan.zhihu.com/p/1901923837408412283](https://zhuanlan.zhihu.com/p/1901923837408412283?share_code=1ixJdgZB0jvhZ&utm_psn=1946714432546801517) — 知乎 / 小马要努力变强, 2025-05-03. Read 2026-05-15.
