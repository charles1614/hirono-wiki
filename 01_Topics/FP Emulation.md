---
created: 2026-05-12
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 1
---

# FP Emulation

## What

Software emulation of higher-precision floating-point on lower-precision hardware (e.g., FP64 / FP32 emulation on Tensor Cores).

## Current understanding

**FP Emulation** refers to software techniques for emulating higher-precision floating-point arithmetic on hardware that natively supports only lower-precision formats — for example, performing FP64 or FP32 semantics on hardware whose fastest execution units (e.g., Tensor Cores) operate in FP16, BF16, or FP8.

No sources have been ingested for this topic yet, so the following reflects general domain knowledge rather than corpus-derived claims.

The core primitive is **double-word arithmetic**: representing a high-precision value as the unevaluated sum of two lower-precision floats (the "double-double" or "double-float" technique). Operations on such pairs require careful sequencing of rounding to preserve accuracy — Dekker split, Veltkamp split, and the TwoSum / TwoProduct algorithms are the classical building blocks. The technique extends to quad-double and beyond at increasing cost.

The practical motivation in ML hardware contexts is that Tensor Cores deliver orders-of-magnitude higher throughput than scalar FP64 units, so emulating FP64 accumulation via FP32 pairs (or emulating FP32 via BF16/FP16 pairs) can yield a net throughput win even after accounting for the extra operations, provided the algorithm tolerates the residual rounding error.

The main trade-offs are **accuracy vs. throughput vs. memory bandwidth**: emulated precision is never exact (rounding error accumulates differently than in native arithmetic), memory traffic doubles or quadruples for the extra words, and not all algorithms benefit — iterative solvers with natural error-correction (e.g., mixed-precision iterative refinement) are better candidates than dense direct solvers where roundoff compounds.

Once sources covering this topic are ingested, this section should be updated to attribute specific accuracy bounds, benchmark comparisons, and algorithm variants to their respective papers or implementations.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
