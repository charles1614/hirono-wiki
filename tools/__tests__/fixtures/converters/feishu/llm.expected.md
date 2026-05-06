# LLM

> 原文链接: https://d0a901er7io.feishu.cn/wiki/RMTLwJwfgic9orkzXX5cg00GnKc
> Source: lark-hirono (authenticated Feishu API)

---
### Communication Pattern Modeling

The system models different collective communication patterns based on training parallelism strategies:

| Operation | Description | Typical Use Case |
| --- | --- | --- |
| `All_Reduce` | Reduce and broadcast result | Gradient synchronization |
| `All_Gather` | Gather data from all ranks | Parameter collection |
| `Reduce_Scatter` | Reduce and distribute chunks | Distributed gradient updates |
| `All_to_All` | Personalized all-to-all exchange | Expert routing in MoE |
| `All_Reduce_All_to_All` | Combined operation | Hybrid communication patterns |
| `All_Reduce_NVLS` | NVLS-optimized AllReduce | High-bandwidth AllReduce |

| Parallelism Type | Communication Pattern | Collective Operations |
| --- | --- | --- |
| Tensor Parallelism (TP) | Parameter synchronization within TP group | `allreduce`, `allgather`, `reducescatter`, `alltoall` |
| Data Parallelism (DP) | Gradient synchronization across DP group | `allreduce`, `allgather`, `reducescatter` |
| Expert Parallelism (EP) | Expert routing and load balancing | `allgather`, `reducescatter`, `alltoall` |
| Pipeline Parallelism (PP) | Activation/gradient passing between stages | `send`, `recv` |

example

| Layer Type | Forward Communication | Backward Communication | Parallelism Type |
| --- | --- | --- | --- |
| **embedding_layer** | AllReduce | None | TP |
| **attention_column** | AllGather | ReduceScatter | TP |
| **attention_row** | ReduceScatter | AllGather | TP |
| **mlp_moelayer** | AllGather, AllToAll | AllGather, AllToAll | TP+EP |
| **grad_gather** | None | AllGather | DP |
| **grad_param_comm** | None | ReduceScatter | DP |
| **moe_grad_norm** | None | AllGather/ReduceScatter | DP+EP |
