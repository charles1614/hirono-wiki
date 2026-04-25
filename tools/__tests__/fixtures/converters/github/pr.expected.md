# [KVConnector] Add metrics to Prometheus-Grafana dashboard · Pull Request #26811 · vllm-project/vllm

> 原文链接: https://github.com/vllm-project/vllm/pull/26811
> Status: **merged** by simon-mo on Oct 29, 2025
> Labels: `ready`, `v1`, `kv-connector`
> Branches: `nixl-prometheus` → `main`
> Diff: +365 / -29 across 6 files

---

## NickLucche

> opened this on Oct 14, 2025 · Collaborator

Follow-up to the work and discussion in this PR https://github.com/vllm-project/vllm/pull/22188.
Here we expose the metrics we're currently tracking for the nixl connector to prometheus.

![image](https://github.com/user-attachments/assets/502e0a19-a66b-49d5-b2ae-0e5caf0bf759)

cc @markmc  

Update:
@markmc generalized the PR to work for KVConnectorStats more broadly

---

## markmc

> reviewed (changes requested) on Oct 24, 2025 · Member

Hey @NickLucche 

I wanted to make sure the per-connector metrics was going to work out. I didn't feel good about adding a bunch of NIXL-specific metrics into `vllm/v1/metrics`. So I worked it out at NickLucche/vllm/pull/4

Couple of small inline comments on buckets too :+1:

---

## simon-mo

> reviewed (approved) on Oct 28, 2025 · Collaborator

@markmc reviewed

---

## markmc

> review-commented on Oct 23, 2025 · Member · file `vllm/v1/metrics/loggers.py`

Phancy! ITYM

```
# uniform 2kib to 8gib range
buckets = [2**(10 + i) for i in range(1, 24, 2)]
```

Checking it out:

```
>>> def human_size(bytes, units=[' bytes','KB','MB','GB','TB', 'PB', 'EB']):
...     """ Returns a human readable string representation of bytes """
...     return str(bytes) + units[0] if bytes < 1024 else human_size(bytes>>10, units[1:])
... 
>>> [human_size(2**(10+i)) for i in range(1, 25, 2)]
['2KB', '8KB', '32KB', '128KB', '512KB', '2MB', '8MB', '32MB', '128MB', '512MB', '2GB', '8GB']
```

---

## markmc

> review-commented on Oct 23, 2025 · Member · file `vllm/v1/metrics/loggers.py`

This suggests we expect transfer times to have a smaller minimum than post times? I had understood the opposite?
