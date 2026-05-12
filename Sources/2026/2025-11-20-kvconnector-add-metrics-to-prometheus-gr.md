---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://github.com/vllm-project/vllm/pull/26811
tags: [observability, kv-cache, inference, tooling]
---

# [2025-11-20] [KVConnector] Add Metrics to Prometheus-Grafana Dashboard

## TL;DR

vLLM PR #26811 (merged Oct 29 2025 by `simon-mo`) — exposes **per-KVConnector metrics to Prometheus**, follow-up to PR #22188. NickLucche shipped NIXL-specific metrics first; `markmc` then **generalized to KVConnectorStats** so the metric surface isn't hard-coded to NIXL. Small PR (+365/-29 across 6 files) but architecturally meaningful: vLLM's KV-cache observability now has a connector-agnostic shape that future KV-transfer backends (Mooncake, custom RDMA) can plug into. Includes histogram-bucket tuning for transfer size (2KB → 8GB log-scale buckets) and a tense back-and-forth between contributors on whether transfer-time should have smaller minimum than post-time (answered in review).

## Key claims

- **What's exposed**: KV-cache connector transfer/post metrics — sizes (bytes), durations (ms), counts — surfaced via Prometheus exposition so existing Grafana dashboards can consume.
- **Generalization from NIXL → KVConnectorStats** is the load-bearing design change: `markmc` rejected adding NIXL-specific metrics into `vllm/v1/metrics/` and worked out a per-connector stats abstraction at NickLucche/vllm#4. **The result is connector-pluggable observability** — any future KV-transfer mechanism (RDMA backend, Mooncake-style store) gets the same metric shape for free.
- **Bucket tuning**: histogram buckets for transfer sizes use `2**(10 + i) for i in range(1, 24, 2)`, yielding `[2KB, 8KB, 32KB, 128KB, 512KB, 2MB, 8MB, 32MB, 128MB, 512MB, 2GB, 8GB]`. **Log-scale × 4 grain** — the sweet spot for histograms spanning small-pages-to-large-models without over-bucketing.
- **PR-review tension worth noting**: reviewer flagged that "transfer times have smaller minimum than post times" might be backwards — implies a real question about which step is faster in practice. Resolution is in the review-comment thread, not the merged code; the histogram bucket choices reflect the final understanding.
- **The connector being exposed is NIXL** — vLLM's primary KV-transfer backend for PD-disaggregated serving. NIXL's metrics weren't visible to operator dashboards before this PR; PD-disagg deployments were operating with a blind spot on the data-plane.
- **Branch**: `nixl-prometheus` → `main`. **Labels**: `ready`, `v1`, `kv-connector`. Falls under the v1 metrics path — important for forward compat as the v1 engine becomes the default.

## Visual observations

**Prometheus-Grafana KVConnector dashboard** (load-bearing — shows the concrete metric surface this PR exposes)

![Grafana dashboard panel rendering the new KVConnector metrics exposed by the PR: NIXL transfer durations, sizes, counts — the operator-visible artifact this PR enables](../../raw/raindrop/github.com/2025-11-20-kvconnector-add-metrics-to-prometheus-gr/github-img-001.png)

The concrete UX the PR delivers. Without this, "metrics in Prometheus" stays abstract; with it, the operator sees exactly what dashboards a PD-disaggregated vLLM cluster gains.

## What this changes

- **For operators running PD-disaggregated vLLM**: KV-transfer observability is now in Prometheus by default. Long-tail KV-transfer latency becomes a first-class metric for SLO tracking. Pairs with [[2025-11-17-feature-sglang-tracing-fine-grained-trac]] (SGLang goes spans-first; vLLM goes metrics-first — same observability need, different shapes).
- **For framework authors writing new KV connectors**: the generalized `KVConnectorStats` abstraction means new backends inherit the dashboard story. Lowers the bar for shipping experimental KV-transfer backends.
- **For [[NIXL]] specifically**: this is its first-class observability landing in vLLM. NIXL-stack operators can correlate transfer slowdowns against request-level latency in a single dashboard.
- **Histogram-bucket recipe (`2KB...8GB` log-scale × 4)**: generally applicable to any KV-transfer or weight-loading histogram. Worth borrowing.

## Entities touched

[[vLLM]], [[NIXL]], [[Prometheus]], [[Grafana]], [[KV Connector]], [[KVConnectorStats]]

## Topics touched

[[LLM Inference Systems]], [[Inference Disaggregation]], [[KV Cache Management]], [[Observability]]

## Raw source

[github.com/vllm-project/vllm/pull/26811](https://github.com/vllm-project/vllm/pull/26811) — small PR (+365 / -29, 6 files). Merged 2025-10-29 by `simon-mo`. Follow-up to PR #22188. Contributors: NickLucche (author), markmc (refactored to generic abstraction), simon-mo (approver). Read 2026-05-11.
