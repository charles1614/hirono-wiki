---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://github.com/vllm-project/vllm/pull/26811
tags: [vllm, observability, prometheus, kv-cache, disaggregation, nixl]
---

# [2025-11-20] [KVConnector] Add metrics to Prometheus-Grafana dashboard — vLLM PR #26811

## TL;DR

[[vLLM]] PR by NickLucche (merged Oct 29, 2025) wiring the **KVConnector** (vLLM's pluggable cross-instance KV-cache transport — currently dominated by [[NIXL]]) into Prometheus-Grafana metrics. Started as NIXL-specific; markmc generalized it to `KVConnectorStats` so any future KV-transport backend gets metrics for free. **+365 / −29 across 6 files**, 4 reviewers, 1 substantive review-comment back-and-forth on histogram bucket choices. Small PR by line count, big PR by what it signals: KV-disaggregation is moving from "experimental feature" to "production observable."

## Key claims

- The KVConnector abstraction now has a stats-collection interface (`KVConnectorStats`) — observability is a first-class concern, not a NIXL-specific add-on. Other KV-transport backends will inherit.
- Histogram bucket discussion (markmc + NickLucche on `vllm/v1/metrics/loggers.py`): the chosen scale is **uniform 2 KiB to 8 GiB**, calculated as `[2**(10 + i) for i in range(1, 24, 2)]`. This is the production size range KV transfers actually span — useful empirical signal for sizing capacity.
- Implementation pattern: per-connector subclasses can extend the base stats interface but expose through one shared Prometheus surface. Avoided the anti-pattern of "NIXL-named metrics in core vllm/v1/metrics" that markmc explicitly pushed back on.
- Status: merged by simon-mo (vLLM core); cleanly reviewed; not a contentious change. Indicates the disaggregation-via-KV-transport architecture is stable enough to be observable.

## Entities touched

[[vLLM]], [[NIXL]], [[Prometheus]], [[Grafana]]

## Topics touched

[[Inference Disaggregation]], [[Distributed-Serving Observability]], [[KV Cache Management]]

## Open questions

- The metric surface here is **Prometheus histograms / counters** — vs [[2025-11-17-feature-sglang-tracing-fine-grained-trac]] which uses [[OpenTelemetry]] spans. Two ecosystems converging on observability from different starting points — does each grow into the other's strength, or do they stay specialized (vLLM = metrics-first, SGLang = traces-first)?
- 2 KiB to 8 GiB transfer bucket range is large — what's the actual production distribution shape? Most transfers small (per-token KV) or large (per-request KV migration)?
- KVConnector is the abstraction layer; NIXL is one backend. What other backends are coming? GPU-direct-RDMA? Mooncake's transfer engine? The metric interface here decides what's *measurable* across them.
- The base PR (#22188) is the foundational KV-Connector work; this is a follow-up. Worth reading the foundation to understand what NIXL transports + when it's invoked (prefill→decode handoff vs. cross-replica migration).

## Raw source

[github.com/vllm-project/vllm/pull/26811](https://github.com/vllm-project/vllm/pull/26811) — 2 KB body, merged. References predecessor PR #22188 (the KV-Connector foundation).
