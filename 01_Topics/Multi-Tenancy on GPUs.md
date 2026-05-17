---
created: 2026-05-12
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 2
---

# Multi-Tenancy on GPUs

## What

Sharing a single GPU between multiple tenants / workloads — MPS, MIG, green contexts, MLOPart.

## Current understanding

No sources have been ingested under this topic yet. The understanding below is a structural placeholder drawn from the topic framing; it will be replaced once Sources are cited.

**GPU multi-tenancy** refers to sharing a single physical GPU across multiple independent workloads or tenants simultaneously, as opposed to exclusive per-job allocation. The core challenge is that GPUs were designed for throughput over isolation: a single process typically holds the entire device context, making time- or space-sharing non-trivial.

Four main mechanisms exist at different points in the stack. **MPS (Multi-Process Service)** is CUDA's software-layer approach: multiple CUDA processes share a single GPU context via a daemon, reducing context-switch overhead but offering no hard memory or fault isolation — a crash in one client can affect others. **MIG (Multi-Instance GPU)**, introduced on A100/H100, partitions the GPU in hardware into up to seven isolated slices (each with dedicated SMs, caches, and memory bandwidth), providing true fault and performance isolation at the cost of coarser granularity and reduced utilization when workloads are smaller than one MIG slice.

**Green contexts** (CUDA 12.4+) represent a lighter-weight approach: they allow multiple CUDA contexts to coexist on a device with lower overhead than full MPS, targeting inference serving scenarios where many model replicas need to share memory efficiently. **vGPU / SR-IOV** (vendor and hypervisor dependent) virtualizes the GPU for VM-level tenancy, relevant in cloud and enterprise deployments where the unit of isolation is a virtual machine rather than a process.

The practical trade-off space is isolation vs. utilization vs. granularity. MIG gives the strongest isolation but wastes capacity when workloads are bursty or small. MPS gives better utilization but weaker isolation. Inference serving frameworks (vLLM, TGI, TensorRT-LLM) increasingly treat multi-tenancy as a scheduler-layer problem — packing requests via continuous batching rather than partitioning the GPU — which sidesteps hardware partitioning entirely for homogeneous workloads.

This section will be expanded once specific Sources covering MIG configuration guides, MPS benchmarks, green-context API details, or multi-tenant serving architecture are ingested.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
