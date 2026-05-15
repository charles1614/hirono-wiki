---
created: 2026-05-15
updated: 2026-05-15
type: topic
source_count: 1
---

# GPU Memory Management

## What

How GPU memory is allocated, profiled, and estimated for deep-learning workloads — covering the five memory zones of a training loop, tooling for visibility, and estimation formulas for pre-run capacity planning.

## Current understanding

GPU memory during a [[PyTorch]] training loop decomposes into five named zones: **model parameters** (blue; static across iterations), **forward-pass activations** (orange; grow layer-by-layer, retained until the next forward pass overwrites them), **gradients** (yellow; accumulate during backward), **optimizer state** (green; initialized once per run — for [[AdamW]] this is two moments per parameter, so 2NP bytes), and **optimizer intermediates** (red; transient during the update step). The peak depends on batch size: large batches peak during the forward pass (parameters + optimizer state + activations); small batches peak during the optimizer step (parameters + optimizer state + gradients + optimizer intermediates). The general formula:

\\( \text{Total} = 3NP + \max(NP,\ A \times B \times L \times P) \\)

where N = parameter count, P = bytes per parameter, A = activations per token, B = batch size, L = sequence length.

[[PyTorch]] ships a first-party profiler: `torch.cuda.memory._record_memory_history` + `_dump_snapshot` produces a `.pkl` that [pytorch.org/memory_viz](https://pytorch.org/memory_viz) renders as an interactive timeline — useful for identifying which zone is driving OOM events. Activations per token can be measured via forward hooks; empirically, A ≈ 4.69 × 10⁻⁴ × N + 1.85 × 10⁶ across several LLMs, giving a practical pre-run heuristic. — [[2025-09-22-visualize-and-understand-gpu-memory-in-p]]

## Open threads

## Sources drawn on

_(populated as Sources wikilink this Topic; cite each with one-line relevance.)_
