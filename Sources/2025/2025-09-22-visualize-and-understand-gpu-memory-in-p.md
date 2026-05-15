---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://huggingface.co/blog/visualize-gpu-memory
tags: [training, gpu, tooling, observability]
---

# [2025-09-22] Visualize and understand GPU memory in PyTorch

## TL;DR

HuggingFace tutorial (Quentin Gallouédec) on profiling and estimating GPU memory during [[PyTorch]] training. Walks through `torch.cuda.memory._record_memory_history` + the pytorch.org/memory_viz visualizer, annotates the five memory zones in a training loop (parameters, activations, gradients, optimizer state, optimizer intermediates), derives an estimation formula for total memory, and provides a live interactive calculator.

## Key claims

- **Memory profiling API**: `torch.cuda.memory._record_memory_history(max_entries=100000)` records all GPU memory events; `_dump_snapshot("profile.pkl")` saves them; dragging the pkl to [pytorch.org/memory_viz](https://pytorch.org/memory_viz) renders an interactive timeline.
- **Five color-coded zones** in a training-loop memory profile: (blue) model parameters, (orange) forward-pass activations, (yellow) gradients, (green) optimizer state (initialized once), (red) optimizer intermediates during the parameter update step.
- **Activation retention during forward passes**: activations from iteration N are not freed until the forward pass of iteration N+1 overwrites them, so peak memory during multi-iteration profiling shows two overlapping activation buffers; `torch.no_grad()` eliminates this.
- **Batch-size governs which phase peaks**: at large batch size the forward pass is the peak (parameters + optimizer state + activations); at small batch size the optimizer step is the peak (parameters + optimizer state + gradients + optimizer intermediates). The general formula accounts for both:

  \\( \text{Total Memory} = N \times P \times 4 + \max(N \times P,\; A \times B \times L \times P) \\)

  i.e. `3NP + max(NP, ABLP)` where the 3NP covers optimizer state (2NP) + gradients or intermediates (NP), and NP is model parameters.
- **Component-by-component estimates** for a model with N parameters at precision P bytes:
  - Model parameters: `N × P`
  - AdamW optimizer state: `2 × N × P` (two moments per parameter)
  - Gradients: `N × P`
  - Optimizer intermediates: `N × P`
  - Activations: `A × B × L × P` where A ≈ activations per token
- **Activations-per-token heuristic**: measuring via forward hooks across several LLMs yields a rough linear relationship `A ≈ 4.69 × 10⁻⁴ × N + 1.85 × 10⁶`; not exact but practical for pre-run estimates without running the model.
- **Worked example**: Qwen2.5-1.5B (1.5B parameters, float32) → model 6 GB; optimizer state 12 GB; gradients/intermediates 6 GB; 5,065,216 activations per token measured via hooks.

## Visual observations

**Fig — Simple profiler output, annotated** (load-bearing)

![Annotated memory profile for a single nn.Linear model showing 12 labeled events across 3 training loop iterations](../../raw/raindrop/huggingface.co/2025-09-22-visualize-and-understand-gpu-memory-in-p/huggingface-002.png)

Step-by-step breakdown: model allocation at start, then per-iteration twin spikes (input + output tensors), demonstrating that prior-loop activations persist until overwritten in the next forward pass.

**Fig — Colorized training profile for Qwen2.5-1.5B** (load-bearing)

![Color-coded GPU memory profile for a real LLM training loop: blue parameters flat across all iterations, orange activations growing during forward, yellow gradients appearing during backward, green optimizer state initialized once, red optimizer intermediates during update step](../../raw/raindrop/huggingface.co/2025-09-22-visualize-and-understand-gpu-memory-in-p/huggingface-004.png)

Five-zone colorization maps directly to the estimation formula components; three identical spikes confirm the per-iteration pattern.

- **Fig — Batch-size effect** (`huggingface-005.png`): reducing batch from 16 to 2 shifts the peak from the forward pass to the optimizer step — motivates the `max(...)` term in the formula.
- **Fig — Activations vs. parameters scatter** (`huggingface-006.png`): linear fit across several LLMs visualized; supports the heuristic `A ≈ 4.69 × 10⁻⁴ × N + 1.85 × 10⁶`.

## Entities touched

[[PyTorch]], [[CUDA]], [[AdamW]], [[Qwen]]

## Topics touched

[[GPU Memory Management]], [[LLM Training Systems]]

## Raw source

[huggingface.co/blog/visualize-gpu-memory](https://huggingface.co/blog/visualize-gpu-memory) — blog post by Quentin Gallouédec (HuggingFace) · 6 images · read 2026-05-15. Interactive calculator embedded via HF Space; not captured in raw.
