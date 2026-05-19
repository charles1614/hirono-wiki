---
created: 2026-05-12
updated: 2026-05-12
type: source
source_url: https://mp.weixin.qq.com/s/<baidu-baige-kv-cache>
tags: [inference, kv-cache, scheduling]
---

# [2026-04-01] 百度百舸 AttentionStore: KV Cache 调度与加速引擎

## TL;DR

A weixin post by **百度智能云技术站** describing **AttentionStore** — Baidu Baige's (百舸) production KV-cache **scheduling + tiered-storage + transfer-acceleration** engine for serving long-context Claude-style coding agents cost-effectively. The architecture is two-layer: **cluster-level** (global KV-cache awareness + precise scheduling factoring cache locality, instance load, node health) and **node-level** (3-tier L1 HBM / L2 DRAM / L3 SSD cache + acceleration primitives: huge-pages / pinned memory / pipelined parallel reads / async eviction). On **昆仑芯 P800 + TP4 DP4 + DeepSeek R1 671B at 64K context**, AttentionStore reduces **TTFT by 6.2×** vs SGLang's default cache policy. The architectural commitment: treat KV cache as a first-class scheduling primitive (request routing decisions depend on cache-locality), not a per-instance afterthought.

## Key claims

**KV cache cost is the load-bearing economics**: the size formula `Size_kv_cache = 2 × layers × kv_heads × head_dim × bytes_per_element` makes the per-token cost explicit. At long context + many concurrent sessions, KV-cache reuse + eviction policy dominates serving economics.

**Two-layer architecture:**

1. **Cluster-aware scheduling**: AttentionStore Master holds a global block-level index of where every KV block lives (which instance + which storage tier). Example entries from the diagram:
   - Block [a,b,c]: 【实例 + HBM】 OR 【节点 + DRAM】
   - Block [g,h,i]: 【节点 + SSD】

   Scheduler queries the index to route incoming requests by cache-locality. Decision factors: KV Cache locality + 实例负载 (instance load) + 节点健康 (node health). The "cache-aware routing" pattern, productized at fleet scale.

2. **Node-local 3-tier cache**: L1 HBM (XPU instance) / L2 DRAM (node) / L3 SSD (node). Each node's AttentionStore Agent reports up to the Master via 信息上报 (info reporting), keeping the global index live-consistent.

**Inference-engine integration**: each node runs vLLM or SGLang + an AttentionStore Agent sidecar. Notable: AttentionStore is engine-agnostic — works as a separate scheduling + caching layer on top of either inference framework.

**KV cache transfer acceleration** (4 primitives stacked):

- **Huge pages + pinned memory** for fast DRAM↔HBM transfers
- **Pipelined parallel reads** — overlap DRAM-to-HBM with SSD-to-DRAM (the load-bearing optimization, see "before/after" comparison below)
- **Async eviction** — eviction doesn't block read path

**Before/after read pipelining**:

- **Before (3 sequential steps)**: ① DRAM-KV → HBM (red arrow), ② SSD-KV → DRAM (green), ③ DRAM → HBM (green). Steps 2+3 are serial.
- **After (2 parallel-pipelined steps)**: ① DRAM-KV → HBM AND SSD-KV → DRAM happen **simultaneously** (huge-page + pinned-memory makes this safe), then ② DRAM → HBM. Pipeline collapses 3 serial steps into 2.

**PD-disaggregated data path**: Prefill node has HBM + DRAM/SSD; Decode node has HBM only. KV write-back from Decode flows back to Prefill node's DRAM/SSD via labeled transfer paths. Each role optimized separately.

**Headline benchmark — TTFT 6.2× reduction**:

- Hardware: 昆仑芯 (Kunlun) P800 (Baidu's custom XPU; not NVIDIA)
- Parallelism: TP4 DP4
- Model: DeepSeek R1 671B
- Context: 64K tokens
- Comparison: SGLang default cache policy vs SGLang + AttentionStore
- Result: TTFT reduced by 6.2×

The Kunlun-P800 detail is the meta-claim: this isn't a NVIDIA-stack optimization — Baidu Baige's stack works on Baidu's own silicon at production scale.

## Visual observations

**AttentionStore 2-layer architecture** (`https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-04-01-拒绝-openclaw-成为-吞金龙虾-百度百舸打造极致-kv-cache-调度/weixin-img-003.png`)

![AttentionStore 2-layer architecture: cluster-awareness layer (global KV cache awareness + precise scheduling: node/instance + storage medium + node health + instance load + KV cache) and node-cache layer (local cache index over HBM/DRAM/SSD + transfer acceleration via huge-pages/pinned memory/pipeline parallel read/async eviction + 3-tier multi-level cache L1 HBM / L2 DRAM / L3 SSD)](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-04-01-拒绝-openclaw-成为-吞金龙虾-百度百舸打造极致-kv-cache-调度/weixin-img-003.png)

The 2-layer split between cluster-level scheduling and node-level cache management is the architectural commitment — neither layer alone suffices; both must compose for the scheduling decisions to actually land on cache-hot nodes.

**Global awareness + scheduling flow** (`https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-04-01-拒绝-openclaw-成为-吞金龙虾-百度百舸打造极致-kv-cache-调度/weixin-img-004.png`)

![Global scheduling flow: 对话 (Request) → Scheduler (queries AttentionStore Master global block-index showing [实例+HBM]/[节点+DRAM]/[节点+SSD] placements) → routes to Inference Nodes each running vLLM or SGLang + AttentionStore Agent that reports KV info back to the Master](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-04-01-拒绝-openclaw-成为-吞金龙虾-百度百舸打造极致-kv-cache-调度/weixin-img-004.png)

The scheduling-decision flow: cache-locality is a first-class scheduler input, not an after-the-fact optimization. AttentionStore Master is the global authority for "where does block X live"; Scheduler routes accordingly.

**Read-pipelining before/after** (`https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-04-01-拒绝-openclaw-成为-吞金龙虾-百度百舸打造极致-kv-cache-调度/weixin-img-006.png`)

![Before-after comparison: BEFORE — 3 serial steps (DRAM→HBM, then SSD→DRAM, then DRAM→HBM); AFTER — 2 pipelined steps with huge-pages/pinned-memory enabling simultaneous DRAM→HBM and SSD→DRAM, then second DRAM→HBM](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-04-01-拒绝-openclaw-成为-吞金龙虾-百度百舸打造极致-kv-cache-调度/weixin-img-006.png)

The pipelining trick — huge-page + pinned-memory enables safe simultaneous DRAM↔HBM + SSD↔DRAM transfers, collapsing 3 sequential steps to 2. The kind of low-level memory-system primitive whose payoff (TTFT 6.2×) is felt at the operator level.

**TTFT benchmark — SGLang vs AttentionStore** (`https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-04-01-拒绝-openclaw-成为-吞金龙虾-百度百舸打造极致-kv-cache-调度/weixin-img-007.png`)

![TTFT bar chart: 昆仑芯 P800 / TP4 DP4 / DeepSeek R1 671B / 64K context. Left bar (tall): SGLang default cache policy; Right bar (~1/6 height): SGLang with AttentionStore. Annotation: "TTFT 降低 6.2 倍" (6.2× reduction)](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-04-01-拒绝-openclaw-成为-吞金龙虾-百度百舸打造极致-kv-cache-调度/weixin-img-007.png)

The headline result. Notable that the benchmark runs on Kunlun-P800 (not NVIDIA) — proves AttentionStore is hardware-portable; the wins come from the scheduling + storage-tier architecture, not vendor-specific kernels.

## What this changes

A second cache-aware-routing Source for the wiki — pairs with [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] which analytically argued KV-cache transfer bandwidth isn't the bottleneck. AttentionStore confirms that finding empirically: the bottleneck is **scheduling + storage-tier orchestration**, not the link itself. The 6.2× TTFT win comes from pipelining + cache-locality routing, not from a faster HBM bus.

Updates [[KV Cache Management]] with concrete L1/L2/L3 tiering vocabulary and the cluster-vs-node-level scheduling split. Specifically:

- **3-tier cache** (HBM / DRAM / SSD) is now a documented production-deployed pattern, not theoretical.
- **Pipelining via huge-pages + pinned memory** is a generally-applicable primitive — same trick could plausibly help DRAM-HBM-SSD pipelines in any inference stack, not just AttentionStore.
- **Cluster-aware scheduler routes by cache-locality** — orthogonal complement to PD-disaggregation. The cache-aware routing pattern is what V4's on-disk KV cache reuse mechanism ([[2026-04-27-deepseek-v4砍掉mla-一个月前有人预言了-小红书]]) makes possible end-to-end.

**Open thread**: AttentionStore is described as engine-agnostic (vLLM or SGLang via sidecar Agent). Is it open-source / has it been upstreamed into either project? The post doesn't say. If it's Baidu-internal-only, that's a deployment moat; if it's published, the wider community could adopt the pipelining-via-huge-page pattern.

The **Kunlun P800 benchmark substrate** is itself worth tracking — Baidu's custom inference XPU at TP4 DP4 running DeepSeek R1 671B at 64K is a public-but-rare datapoint on non-NVIDIA frontier inference performance.

## Raw source

> Platform: weixin · 公众号 百度智能云技术站 · 发布 2026-04-01
> System: AttentionStore (KV-cache scheduling + tiered storage + transfer-acceleration)
> Hardware: 昆仑芯 (Kunlun) P800 · TP4 DP4
> Model + workload: DeepSeek R1 671B @ 64K context
> Headline result: 6.2× TTFT reduction vs SGLang default cache policy
> Image extraction: Sonnet subagent pass; see `<slug>-images-extract.md` sibling
> Related corpus: [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] (KV-bandwidth analysis), [[2026-04-27-deepseek-v4砍掉mla-一个月前有人预言了-小红书]] (V4 on-disk KV), [[KV Cache Management]] (Topic)
