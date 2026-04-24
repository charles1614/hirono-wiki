# 📉 FFD packing by qgallouedec · Pull Request #3521 · huggingface/trl

> 原文链接: https://github.com/huggingface/trl/pull/3521

---

## qgallouedec

> opened this on Jun 1, 2025 · Member

This PR introduces a new packing strategy, FFD (First Fit Decreasing). 
Advantages:
- FFD preserves the integrity of individual sequences by never cutting them in the middle, maintaining natural structure and context flow.
Drawbacks:
- FFD is slower than fixed packing (the one currently used), but the speed remain very reasonable
- It achieves slightly worse padding efficiency, though the padding overhead is typically minimal.

| | Fixed | FFD |
|-|-|-|
| Fast? | Very 🤗 | Yes 😊 |
| Tokens exceeding `max_length` discarded | No 😊 | Yes 🫤 |
| Cut in the middle | Yes 🫤 | No 😊 |

![image](01-image.bin)


### Benchmark

#### Speed

Time to pack a dataset containing 100k rows (hardly correlated  to `max_length`)
- Fixed strategy: 0.3155 seconds
- FFD strategy: 10.3634 seconds

So it's way slower (~30 times) but still very reasonable

##### Code used

<details>

```python
import timeit
import numpy as np
from datasets import Dataset
from trl.data_utils import pack_dataset

# Create a larger dataset with sequence lengths following a gamma distribution
num_samples = 100_000

# Generate sequence lengths following a gamma distribution
seq_lengths = np.random.gamma(shape=5, scale=20, size=num_samples) # mean will be 100
seq_lengths = np.clip(seq_lengths, 10, None).astype(int)  # Clip to [10, inf)

# Generate input sequences with random lengths based on gamma distribution
examples = {
    "input_ids": [list(range(length)) for length in seq_lengths],
    "attention_mask": [[1] * length for length in seq_lengths],
}

dataset = Dataset.from_dict(examples)
max_length = 256  # Set a fixed packing length

# Benchmark pack_dataset for both strategies
time_pack_dataset_ffd = timeit.timeit(lambda: pack_dataset(dataset, max_length, strategy="ffd"), number=5)
time_pack_dataset_fixed = timeit.timeit(lambda: pack_dataset(dataset, max_length, strategy="fixed"), number=5)

# Plot the comparison
print(f"Time for 100k rows with FFD strategy: {time_pack_dataset_ffd:.4f} seconds")
print(f"Time for 100k rows with Fixed strategy: {time_pack_dataset_fixed:.4f} seconds")
```
</details>

#### Padding tokens efficiency

I compared the number of padding tokens (the fewer the better) that we ended up with for different datasets and different sequence lengths.

![padding_comparison_2](02-image.bin)
![padding_comparison](03-image.bin)

##### Code used
<details>

```python
import matplotlib.pyplot as plt
import numpy as np
from datasets import load_dataset
from trl.data_utils import pack_dataset
from transformers import AutoTokenizer

# Setup
num_samples = 50000

# Load and tokenize dataset
tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-7B")

###
# dataset = load_dataset("trl-lib/tldr", split="train").select(range(num_samples))

# def func(example):
#     return tokenizer(example["prompt"] + example["completion"])
# seq_lengths = [512, 1024, 2048]  # Different sequence lengths to compare
###

###
dataset = load_dataset("open-r1/Mixture-of-Thoughts", "all", split="train").select(range(num_samples))


def func(example):
    return {"input_ids": tokenizer.apply_chat_template(example["messages"])}

seq_lengths = [8192, 16384, 32768]  # Different sequence lengths to compare
###

dataset = dataset.map(func, remove_columns=dataset.column_names, num_proc=16)

# Get original sequence lengths for distribution plot
lengths_raw = [len(example["input_ids"]) for example in dataset]

# Calculate padding ratios for different sequence lengths and strategies
padding_results = []

for seq_length in seq_lengths:
    # FFD packing
    ffd_dataset = pack_dataset(dataset, seq_length=seq_length, strategy="ffd", map_kwargs={"num_proc": 16})
    lengths_ffd = [len(example["input_ids"]) for example in ffd_dataset]
    pad_ratio_ffd = sum(seq_length - length for length in lengths_ffd) / (num_samples * seq_length)

    # Fixed packing
    fixed_dataset = pack_dataset(dataset, seq_length=seq_length, strategy="fixed", map_kwargs={"num_proc": 16})
    lengths_fixed = [len(example["input_ids"]) for example in fixed_dataset]
    pad_ratio_fixed = sum(seq_length - length for length in lengths_fixed) / (num_samples * seq_length)

    # No packing (raw)
    pad_ratio_raw = sum(seq_length - length for length in lengths_raw if length < seq_length) / (
        num_samples * seq_length
    )

    padding_results.append([pad_ratio_raw, pad_ratio_fixed, pad_ratio_ffd])

# Create the plot
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(6, 3))

# Subplot 1: Distribution of sequence lengths
ax1.hist(lengths_raw, bins=50, edgecolor="black", alpha=0.7, color="skyblue")
ax1.set_xlabel("Sequence length (tokens)")
ax1.set_ylabel("Number of sequences")
ax1.set_title("Sequence lengths in dataset")
ax1.grid(True, alpha=0.3)

# Subplot 2: Padding comparison
x = np.arange(len(seq_lengths))
width = 0.25

strategies = ["No Packing", "Fixed", "FFD"]
colors = ["#ff7f7f", "#7f7fff", "#7fff7f"]

for i, (strategy, color) in enumerate(zip(strategies, colors)):
    values = [padding_results[j][i] for j in range(len(seq_lengths))]
    ax2.bar(x + i * width, values, width, label=strategy, color=color, edgecolor="black", alpha=0.8)

ax2.set_xlabel("Sequence Length (tokens)")
ax2.set_ylabel("Padding Ratio")
ax2.set_title("Padding tokens ratio\n(lower is better)")
ax2.set_xticks(x + width)
ax2.set_xticklabels(seq_lengths)
ax2.set_ylim(0, 0.5)
ax2.legend()
ax2.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig("padding_comparison.png")
```

</details>

## HuggingFaceDocBuilderDev

> commented on Jun 1, 2025

The docs for this PR live [here](https://moon-ci-docs.huggingface.co/docs/trl/pr_3521). All of your documentation changes will be reflected on that endpoint. The docs are available until 30 days after the last update.

## thepowerfuldeez

> commented on Jun 2, 2025 · Contributor

I could take a look on passing kwargs to flash attn kernel + making packing more efficient today! Great PR, long awaited.
