---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://huggingface.co/blog/train_memory
tags: [training, observability, gpu]
---

# [2025-09-22] Visualize and Understand GPU Memory in PyTorch

## TL;DR

Tutorial by Quentin Gallouédec (HuggingFace) on using PyTorch's built-in GPU memory profiler to visualize, understand, and estimate training memory requirements, with formulas for each memory component and practical optimization tips.

## Key claims

- `torch.cuda.memory._record_memory_history()` + `_dump_snapshot("profile.pkl")` generates a file visualizable at pytorch.org/memory_viz; each training loop shows a characteristic "spike" pattern: model params (blue, persistent) → activations (orange, grow during forward) → gradients (yellow, during backward) → optimizer intermediates (red, during step).
- For Qwen2.5-1.5B (1.5B params × 4 bytes = 6 GB model), a full AdamW training loop peak memory is model + optimizer state (2× params = 12 GB) + max(activations, gradients + optimizer intermediates).
- Peak occurs during forward pass (large batch) or optimizer step (small batch): at batch_size=16 the peak is forward pass; at batch_size=2 the peak shifts to the optimizer step — so memory estimates must account for both scenarios.
- General formula: `Total = Model + Optimizer State + max(Gradients + Optimizer Intermediates, Activations)`.
- Activations scale with sequence length × batch size; model activations are retained during the forward pass because backpropagation needs them — use `torch.no_grad()` in inference to avoid this.
- [[PyTorch]] Profiler snapshot files can become very large (8 MB for 3 steps of Qwen2.5-1.5B); limit steps when profiling.

## Visual observations

![Simple GPU memory profile annotated](https://hirono-wiki.litenext.digital/raindrop/huggingface.co/2025-09-22-visualize-and-understand-gpu-memory-in-p/huggingface-002.png)

![Full LLM training loop memory profile colorized](https://hirono-wiki.litenext.digital/raindrop/huggingface.co/2025-09-22-visualize-and-understand-gpu-memory-in-p/huggingface-004.png)

*Other images decorative — screenshots of the profiler UI and batch-size comparison plots.*

## Entities touched

[[PyTorch]], [[GPU]]

## Topics touched

[[GPU Memory Management]]

## Raw source

[huggingface.co/blog/train_memory](https://huggingface.co/blog/train_memory) — HuggingFace blog by Quentin Gallouédec (@qgallouedec). Read 2026-05-16.
