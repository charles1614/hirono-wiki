---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 4
tier: active
---

# SwiGLU

Swish-Gated Linear Unit activation function used in LLMs including Llama as a replacement for ReLU

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Implemented in a scaled-down [[Llama]] re-implementation as `SwiGLU(x) = (linear_gate(x) * sigmoid(beta * linear_gate(x))) * linear(x)` where beta is a learnable scalar parameter; replacing ReLU with SwiGLU in the feedforward block yields no significant loss improvement at small scale (TinyShakespeare) but matches the Llama paper architecture. — [[2025-05-20-llama-from-scratch-or-how-to-implement-a]]
