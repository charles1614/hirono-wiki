# torch.compile 训练的现状总结（2025年8月）

> 公众号: 代老板的自由天地
> 发布时间: 2025年9月1日 01:04
> 原文链接: https://mp.weixin.qq.com/s/cNTkNZyyETQrHDDYdSSyvw

---
# 前言

近期，PyTorch编译器团队核心成员Edward Yang发布了一篇深度博客，系统梳理了`torch.compile`在训练，特别是自动并行领域的现状与未来，读来令人感慨万千。

这不禁让人回想起三年前，当笔者初涉自动并行领域时，基于JAX+XLA的Alpa（https://arxiv.org/abs/2201.12023） 已在自动并行上做出了坚实的工作。而彼时的PyTorch，DTensor尚在原型阶段，以编译器为核心的PT2尚未问世，更别提compiler-based solution。而如今近3年下来，`torch.compile`技术与生态日趋完善，也终于到了要实现自动并行的阶段。这体现了PyTorch与JAX截然不同的发展路径：

> -   JAX，它从一开始就以 XLA 为核心，在**编译驱动的并行技术方面领先数年**。**JAX 从一个非常通用的求解器开始，并随着时间推移需要添加更多手动逃生舱口（manual escape hatches）**
>
> -   **PyTorch 是从完全手动编写所有分布式模式开始的，我们直到最近才开始添加更多自动化机制，作为手动完成所有事情的替代方案**。
>

这背后正是PyTorch一贯的设计哲学：**用户体验优先**。`torch.compile`要在**不牺牲用户体验的前提下提升性能，尽量的hackable & pythonic**

该博客内容**极其翔实、前沿，是理解PyTorch编译生态演进的必读之作，值得精读** 。下文是我对这篇技术雄文的转译，并附上个人评注

* * *

> 作者：ezyang
> 原文：State of torch.compile for training (August 2025), https://pytorch.org/blog/state-of-torch-compile-for-training-aug-2025/

这篇文章旨在全面总结截至2025年8月 `torch.compile` 在训练领域的最新进展。文中的内容您可能已经从互联网的其他地方零散地了解过，但我们很少将所有信息整合在一起。本文的目标读者是那些正在评估是否将 `torch.compile` 用于大规模训练任务的团队。

首先，我们从基础讲起。`torch.compile`（也称为 PT2）是 PyTorch Eager 模式程序的一个编译器，适用于推理和训练工作负载。与 Eager 代码相比，它通常能带来 **1.5 到 2 倍的加速**，并且 `torch.compile` 还使得全局内存优化（如自动激活检查点，_automatic activation checkpointing_）和分布式通信优化（如异步张量并行，_async tensor parallelism_）成为可能。

# `torch.compile` 的功能特性是什么？

`torch.compile` 的标志性功能是一个可以附加到函数上以进行编译的装饰器：

`@torch.compile() def f(x, y):     ... `

以下是 `compile` 的一些你需要了解的**重要非功能性特性**：

-   **即时编译 (Just-in-time compilation)** ：我们实际上**直到函数第一次被调用时**才对其进行**编译**，并且执行会**阻塞直到编译完成**。我们提供了本地和远程缓存机制，以便在重新运行模型时跳过编译成本。（对于推理，通过 AOTInductor 可以实现预先编译，我们也在为训练场景开发此功能。）

-   **与 Eager 模式可组合 (Compositional with Eager)** ：PyTorch 最初的成功源于 Eager 模式极高的可定制性，而 `torch.compile` 正是致力于保留这一优点。您可以将训练循环中**任意大小的部分进行编译**；**编译后的函数可以**与 `autograd`、`DDP`、`FSDP` 及其他 PyTorch 子系统**组合使用**。（这种组合有时并不完美，例如，在二阶梯度（不支持）、张量子类（需要子类提供特定支持）以及 `autograd`（对从编译区域返回的中间变量求导不起作用）的情况下。）如果某个区域编译失败，您可以使用 `torch.compiler.disable()` 完全禁用它，并回退到 Eager 模式。

-   **梯度更新被延迟到编译区域的末尾** ：这是因为 PyTorch Eager 模式的 `autograd` 不支持从一个大的反向传播节点中流式地增量获取梯度。（这个问题可以通过使用 `compiled_autograd`  https://docs.pytorch.org/tutorials/intermediate/compiled\_autograd\_tutorial.html 来解决，但这要求您的整个反向传播过程都是可编译的。）


> **代老板注：** 此处可以理解为 `torch.compile` 默认复用了 Eager 模式的 `autograd` 机制。它将整个编译区域视为计算图中的一个单一的、粒度较粗的“黑盒”节点。因此，在反向传播时，`autograd` 引擎必须等待这个“黑盒”节点完成其全部内部反向计算后，才能获得其对输入的梯度，从而继续向前传播，这就是“延迟”和无法“流式增量”处理的原因。这样可能会导致内存峰值比 Eager 模式更高，这也是为什么 `torch.compile` 配套了自动激活检查点等内存优化技术。 `compiled_autograd`**PyTorch 2.4版本引入**

-   **图可能会被重新编译 (Graphs may be recompiled)** ：我们积极地对函数中使用的所有非张量参数/全局变量进行特化，以确保我们总是生成没有控制流的直线型计算图。如果这些参数/全局变量发生变化，我们将重新编译图。（你可以通过设置 `torch._dynamo.config.error_on_recompile = True` 来禁止重编译。）

-   **默认为静态，通过重编译支持动态形状 (Static by default, recompile to dynamic shapes)** ：我们默认将所有尺寸积极特化为静态。但是，如果我们发现某个尺寸随时间变化，在第一次重编译时，我们会尝试生成一个能够处理动态形状的单一编译区域。我们不保证一定能成功编译一个具有动态形状的模型。（你可以使用 `mark_dynamic` https://docs.pytorch.org/docs/stable/torch.compiler\_dynamic\_shapes.html 强制输入形状为动态，并使用 `mark_unbacked` 在我们进行特化时报错。）

-   **图中断 (Graph breaks) 会透明地绕过不可捕获的代码**：默认情况下，如果编译器遇到一行它无法处理的代码，它会触发一次图中断，禁用对该行代码的编译，但仍会尝试编译其前后的区域。（此行为可以通过设置 `fullgraph=True`  https://docs.pytorch.org/docs/main/compile/programming\_model.fullgraph\_true.html 来禁止。）

-   **函数调用默认被内联，循环默认被展开** ：如果您的模型中有许多 Transformer 块的副本，您的编译时间将与 Transformer 块的数量成正比。（你可以通过"regional compilation", https://docs.pytorch.org/tutorials/recipes/regional\_compilation.html 来减少编译时间，即只编译 Transformer 块而不是整个模型。）


> **代老板注：**  PyTorch 2.5版本引入

-   **与 Eager PyTorch 并非位级等效 (NOT bitwise equivalent)** ：与 Eager PyTorch 最大的区别在于，当 `float16`/`bfloat16` 操作被融合时，我们不会插入冗余的降/升精度转换。（这可以通过 `torch._inductor.config.emulate_precision_casts = True` 禁用；您也可以重写 Eager 代码以在更高精度下执行操作，并期望 `torch.compile` 会对其进行优化。XLA 有一个类似的配置 `xla_allow_excess_precision`，JAX 默认启用它。）此外，我们也可能决定更换 `matmul` 的实现，并且由于编译时归约顺序的差异，也可能出现一些不可避免的微小偏差。我们支持将图捕获前端与编译器后端分开进行分析，以帮助诊断这类问题。

-   **分布式集合操作和 DTensor 可被编译，但默认不进行优化** ：我们能够捕获 c10d 集合操作以及处理 DTensor 的程序，但默认情况下我们不对集合操作应用优化。（有一些实验性的优化可以启用，但这仍在积极开发中。）我们通常不期望能够追踪通过高度优化的分布式框架代码。


> **代老板注：** DTensor遵循SPMD 设计思想，用户只需定义`DeviceMesh`和分片策略`Placement`，就能像操作本地张量一样操作distributued tensors，由其在底层透明地完成所有分片、计算和通信工作，最初由eager mode支持，后续增加了compile支持，https://docs.pytorch.org/docs/main/distributed.tensor.html

# 先进并行化技术的现状

对于大规模训练，`torch.compile` 面临着来自以下几个方面的激烈竞争：

1.  拥抱 Eager 模式并手动实现所有优化的 PyTorch 原生分布式框架（例如，**megatron**）。

2.  重用我们的追踪机制（例如，`symbolic_trace` 和 `make_fx`）但手动实现其所需 pass 的自定义“编译器”栈。


> **代老板注：**  顶尖的系统工程师、编译器专家和AI基础设施团队，可能只复用torch.compile的抓图，针对自己的场景和模型，自定义编译优化pass，创造新的并行算法和优化技术，获得极致的性能。举个例子（训练不太了解）， 推理引擎vLLM里对torch.compile的使用就是自定义了pass和backend的实现。

3.  JAX，它从一开始就以 XLA 为核心，在**编译驱动的并行技术方面领先数年**。


以下是我们目前在先进并行化方面的进展（重点与 JAX 进行比较）：

-   **DTensor**：一种用于表示分片张量的“全局张量”抽象。DTensor 是一个张量子类，允许我们表示在 SPMD 设备网格上分片的张量。DTensor 的形状反映了原始完整张量的全局形状，但它只根据布局（placement）在本地存储数据的一个分片。以下是一些重要的细节：


-   **分片布局 (Shard placements)** ：与 JAX 的布局不同，DTensor 的布局是面向“设备网格 (device mesh)”的；也就是说，通常指定一个与设备网格维度大小一致的布局列表，`Shard(i)` 表示张量的第 `i` 维被分片。这与 JAX 的面向“张量（tensor）”的方式相反。例如，给定一个二维网格 `["dp", "tp"]`，一个在 DTensor 中布局为 `[Replicate, Shard(0)]`（或使用命名设备网格轴的 `{"dp": Replicate, "tp": Shard(0)}`）的张量，将对应于 JAX 的布局 `P("tp", None)`。这样设计的原因是 DTensor 支持一种 `Partial` 布局，它表示设备网格上的某个轴有待处理的归约操作。`Partial` 在矩阵乘法中普遍存在，并且它不与任何特定的张量轴相关联，**这使得在面向设备网格的表示法中更为方便**。其**代价是，面向设备网格的布局不能原生支持指定分片顺序**，例如，假设我想在一个一维张量上先按 `tp` 再按 `dp` 分片，在 JAX 中我会表示为 `P(("tp", "dp"),)`，但这个顺序无法与 `[Shard(0), Shard(0)]` 区分开，实际上 DTensor 总是强制从左到右分片。目前有一个提案建议扩展我们的分片规范以支持排序，从而在表达能力上与 JAX 看齐，但尚未实现。

-   **自动求导 (Autograd)** ：DTensor 是直接可微的；我们在包含 DTensor 的程序上运行 `autograd`（而不是将 DTensor 程序脱糖为使用常规 Tensor 的程序再进行微分）。这确保了正向计算图的分片策略与其对应的切线（梯度）可以不同。这一点与 JAX 相当。

-   **Tensor 的 Python 子类** ：与 JAX 不同，DTensor 是一个独立于 Tensor 的子类。然而，Tensor 和 DTensor 可以很好地互操作；一个 Tensor 可以简单地被看作是在所有维度上都复制的 DTensor。DTensor 是用 Python 实现的，这使得它易于修改和调试，但也带来了一些开销（例如，FSDP2 不会直接将梯度累积到 DTensor 中，因为当有数千个参数时，对 DTensor 执行 `detach` 和 `add` 操作会成为瓶颈）。尽管有这些开销，DTensor 的设计仍然追求良好的 Eager 性能，并广泛缓存分片传播的结果，以便在快速路径上，它只需要查找应该执行哪个 `redistribute` 操作，然后直接分派到本地的 Eager 操作。然而，这种缓存策略意味着对于具有动态形状的工作负载，开销可能会相当高，因为缓存要求所有输入形状完全匹配。

-   **编译 (Compilation)** ：DTensor 可由 `torch.compile` 编译，这样做会将其脱糖为底层的集合操作，并消除任何 Eager 模式下的 DTensor 开销（即使您不执行任何其他优化）。然而，在 `compile` 中对具有动态形状的 DTensor 的支持还不够完善，请参阅 pytorch/pytorch#159635 (http://github.com/pytorch/pytorch/issues/159635)（我们认为这目前不是任何关键用例的关键路径，所以一位相对初级的工程师一直在逐步解决这个问题）。

-   **贪心传播 (Greedy propagation)** ：因为 DTensor 必须在 Eager 模式下工作，它只实现了贪心分片传播，即对于每个 Eager 操作，我们贪心地选择能使该操作的集合操作成本最小化的输出分片。在编译器类框架的辅助下支持分片的向后传播仍在进行中。

-   **算子覆盖率 (Operator coverage)** ：DTensor 需要分片传播规则才能对操作起作用。如果未实现某个操作的分片传播规则，DTensor 将会失败，而不是触发低效的 `allgather` 以在复制状态下运行该算子。我们目前尚未完全覆盖所有算子，但像 llama3 这样的 Transformer 模型所需的重要算子都已覆盖（分片规则定义在_这里_, https://github.com/pytorch/pytorch/blob/main/torch/distributed/\_tensor/ops）。你可以为用户自定义的算子编写自定义分片规则。


> **代老板注：**  Jax的编译器XLA/OpenXLA的GSPMD是有保底机制的，最劣化情况就是每个设备都复制执行该算子

-   **不规则分片 (Jagged sharding)** ：我们不支持“不规则分片”的概念，这对于具有不平衡路由的专家并行是必需的。然而，我们相信我们现有的分片规则在很大程度上可以被重用以支持这样的想法。由于动态性只会暴露在不规则分片的本地张量中，因此不规则分片不会遇到编译部分提到的动态形状问题。

-   **生态系统 (Ecosystem)** ：我们致力于将 DTensor 作为分片张量的标准表示，DTensor 已与 `checkpointing`、`FSDP2`、`SimpleFSDP`、`AutoParallel`、`torchtitan` 等集成。


* * *

代老板注：

-   checkpointing: https://pytorch.org/blog/activation-checkpointing-techniques/

-   FSDP2: FSDP2 是对 FSDP1 的一次**彻底的现代化重构**。它最大的变化是**用 PyTorch 官方的分布式标准抽象 `DTensor` 取代了 FSDP1 内部的、不透明的 `FlatParameter`（扁平化参数）机制**。 FSDP2 在 API 设计、易用性、性能和生态集成方面都远超 FSDP1。FSDP1 已经被官方弃用  https://docs.pytorch.org/tutorials/intermediate/FSDP\_tutorial.html


-   SimpleFSDP: Simpler Fully Sharded Data Parallel with **torch.compile**, https://github.com/pytorch/torchtitan/tree/main/torchtitan/experiments/simple\_fsdp


-   Torchtitan:  `torch.compile`原生的大模型训练框架, https://github.com/pytorch/torchtitan

-   AutoParallel： pytorch官方正在进行中的自动并行feature  https://github.com/pytorch/pytorch/issues/156217 , https://github.com/pytorch/torchtitan/pull/1657


* * *

-   **函数式集合操作 (Functional collectives)** ：如果您不喜欢 DTensor，我们还支持“函数式集合操作”，这些是集合操作的非原地修改版本，可用于在不需要 DTensor 的情况下，以编译器友好的方式手动实现 SPMD 操作。（实际上，如果您使用传统的集合 API 并对其进行编译，我们会默默地将它们转换为函数式集合操作以用于编译器 pass。）编译后，函数式集合操作不一定会强制分配输出缓冲区，因为它们可以被重新原地执行。重要的是，**函数式集合操作目前不支持 `autograd`** ，请参阅 _Supporting Autograd for Collectives_ (https://discuss.pytorch.org/t/supporting-autograd-for-collectives/219430)。


> **代老板注：**  显示地、手动地使用compilable集合通信原语实现分布式策略，有点类似使用XLA 的 `xm.all_reduce()`实现megatron切分策略。 `torch.compile` 会传统的集合 API比如`dist.all_reduce(x)`（_原地操作_），转换为对编译器优化友好的函数式语言（`x = functional_all_reduce(x)`），完成编译优化后，生成最高效的机器指令，通过重新原地执行，减少额外内存占用。

-   **图捕获 (Graph capture)** ：有两种特别流行的图捕获机制，人们用它们来执行与模型代码分离的分布式优化。所有图捕获机制都生成 FX 图，这是一种简单的、无控制流的 Python 基本块 IR 表示，它对图中实际可以出现的算子集完全没有预设。

    > **代老板注：** PiPPY， https://github.com/pytorch/PiPPy


-   **`make_fx`/`torch.export`** ：这种图捕获机制通过实际将（伪）张量（fake tensor）送入你的程序并记录 ATen 算子来工作。它有多种不同的变体：例如，是采用类似 **JAX jit 的 Python 追踪方法**，还是使用类似 **Dynamo 的复杂字节码分析**；同样，您可以提取**不同级别的 IR**（分派前_pre-dispatch_、分派后_post-dispatch_；算子也可以被**分解**或**保持为单个单元**）。我们的编译器并行化工作建立在这种捕获机制之上，但原则上没有什么能阻止你在这种 IR 之上编写自己的图 pass。在实践中，如果没有 PyTorch 的专业知识，这可能会很困难，因为 (1) 将一个追踪到的图集成到 PyTorch 的 `autograd` 系统中，使其能与其他代码互操作，在完全通用性方面是相当复杂的；(2) 在编译的各个阶段您得到的具体算子集是未文档化的，并且在实践中与 Inductor 的底层栈紧密相关，而且关于如何防止算子在您的 pass 运行之前被分解的文档也很少。


-   **`Symbolic_trace`** ：这是最初的图捕获机制，尽管有其局限性，但仍然相当流行。它完全通过 Python 运算符重载实现，并且会精确地给出图中可重载的任何操作。我们认为这在很大程度上是一个遗留的流水线，因为您无法追踪涉及形状条件判断的代码，并且最终得到的图缺乏关于中间值形状/数据类型的有用元数据。例如，用于实现流水线并行的遗留栈 PiPPY 就是建立在 `symbolic_trace` 图捕获之上的。


-   **默认非 SPMD 编译器 (Not SPMD compiler by default)** ：`torch.compile` 默认不假定被编译的程序是 SPMD 的，这意味着它不会做诸如丢弃未使用的集合操作之类的事情（你可以通过一个配置标志来改变此行为，https://github.com/pytorch/pytorch/issues/146045 ）。此外，`torch.compile` 的默认使用模式是在所有节点上并行编译，这意味着必须小心确保编译器的每个实例都编译出相同的结果（只有一个 rank 重编译，或者编译器做出不同决策，都可能导致 NCCL 超时）。我们**最终认为应该将程序编译一次然后发送到所有节点**，但由于这目前尚未实现，人们解决此问题的通用方法是 (1) 消除所有导致 rank 间行为差异的来源，例如，不允许编译器在做编译决策时查看动态输入的实际大小，或者 (2) 向编译器引入额外的集合操作，以沟通必须在所有 rank 间保持一致的决策。


我们对**先进并行化（advanced parallelism）未来的愿景**，由正在进行中的 `SimpleFSDP` 和 `AutoParallel` 项目引领，是用户应该编写表达其数学意图的单节点程序。然后，这些程序通过两个步骤被转换为高效的分布式程序：(1) 首先，以一种朴素的方式将集合操作插入到图中（即，仅仅为了表达所有中间变量的分片应该是什么），以及 (2) 优化集合操作以处理诸如预取和分桶之类的调度问题。`AutoParallel` 设定了一个**GSPMD**风格的目标，即**自动为程序确定一个足够好的分片方案**——它应该能够**重新发现数据并行、张量并行，甚至专家并行**！——而 `SimpleFSDP` 则设定了一个较小的目标，即**仅按照 FSDP 所要求的模式插入集合操作**，然后**编写 FSDP 特定的优化 pass 来恢复 FSDP2 的性能**。

编写领域特定的优化是很常见的。例如，异步张量并行也是作为一个 pass 实现的，它检测 TP 模式并将其重写为异步 TP操作 (https://discuss.pytorch.org/t/distributed-w-torchtitan-introducing-async-tensor-parallelism-in-pytorch/209487)。与 **JAX 从一个非常通用的求解器开始，并随着时间推移需要添加更多手动逃生舱口**不同，**PyTorch 是从完全手动编写所有分布式模式开始的，我们直到最近才开始添加更多自动化机制，作为手动完成所有事情的替代方案**。

# 优化的现状

`torch.compile` 执行许多优化，但以下是一些**特别需要了解的重要优化**：

-   **Inductor** ：Inductor 是我们 `torch.compile` 的后端，它为 PyTorch 程序生成 Triton 内核。它对 PyTorch 的算子集有非常好的覆盖，并且可以融合点操作和归约操作，包括那些通常在反向传播中出现的模式。它还能够将点操作融合到 `matmul` 中，并自动调整不同的 `matmul` 后端（包括 **cuBlas、cutlass 和 Triton**）以为任何给定尺寸选择最佳的一个。当人们谈论 `torch.compile` 加速他们的程序时，他们通常指的是 Inductor；然而，您不必将 `torch.compile` 与 Inductor 一起使用；例如，您可以只运行 `AOTAutograd` 并跳过 Inductor 编译。

-   **CUDA Graphs** ：Inductor 内置了对 CUDA  graph模型的支持。与手动应用 CUDA 图相比，我们可以提供比手动应用更好的健全性保证（例如，忘记复制所有输入缓冲区，CUDA 图区域内的 CPU 计算）。`torch.compile` 的 **CUDA graph 通常与 Inductor 一起使用**，但我们**也提供一个仅限 Eager 模式的 `cudagraphs` 集成**（这个集成测试得不太充分）。

-   **自动激活检查点 (Automatic activation checkpointing)** ：通过 `torch.compile`，我们可以全局优化内存-计算的权衡，这比 Eager PyTorch 支持的激活检查点 API（需要用户手动指定要检查点的内容）要好得多。然而，有些人报告说调整 AC 的超参数可能相当痛苦；我们也发现过其中的 bug。

-   **FP8 优化** ：传统编译的一个巨大成功案例是为自定义的 FP8 格式添加了支持。通过 `torch.compile`，他们不必为自己的变体编写手动内核。此后，这已被上游到 `torchao`


> **代老板注：**  TorchAO: PyTorch-Native Training-to-Serving Model Optimization， https://github.com/pytorch/ao

-   **Flex Attention**：Flex Attention 的使用持续增长，在开源社区有 632 个下游仓库用户（相比于25年1月的125个）。它已被用于在 llama 系列模型中实现分块注意力、文档掩码和上下文并行。它是一个非常好的研究工具，尽管有时人们会抱怨轻微的数值差异。


> **代老板注：** Flex Attention: A Programming Model for Generating Optimized Attention Kernels ，MLSys2025。一项`torch.compile`之上的重要技术，通过可编译的方式支持各种灵活的attention变体并高效执行  https://pytorch.org/blog/flexattention/ https://pytorch.org/blog/flexattention-for-inference/

-   **Helion**：Helion (https://github.com/pytorch/helion) 是一个正在积极开发的项目，目标是在今年10月进入 beta 阶段，它提供了一个更高级别的接口来编程 Triton 内核，看起来就像编写 PyTorch Eager 代码一样。它严重依赖自动调整（autotuning）来探索内核可能的结构选择空间，以找到最佳的一个。它尚未准备好用于生产，但值得知道它即将到来。


# 编译时间的现状

`torch.compile` 是一个即时（just-in-time，JIT）编译器，因此，在其默认配置下，编译将在您的 GPU 集群上发生（这会阻止您使用 GPU 进行其他有用的工作！）。总的来说，大多数病态的编译时间都源于**重复重编译**（通常是由于动态形状，但有时不是）。在 Transformer 模型中，编译时间也可以通过只编译 Transformer 块来改善（这样可以只编译一次，而不是为模型中的每个 Transformer 块编译 N 次）。

我们认为缓存对于大规模训练来说不是一个理想的长期解决方案，我们一直在努力通过**预编译 (precompile)** 来解决这里的差距。预编译简单来说就是将编译作为一个预先进行的过程，它会生成一个二进制文件，你可以直接从训练脚本中运行以获得编译后的模型。编译产物建立在我们的 ABI 稳定接口（为 **AOTInductor** 开发）之上，这使得相同的二进制文件可以针对多个 PyTorch 版本，即使 PyTorch 库本身不提供版本间的 ABI 兼容性。

# 我该如何开始？

我们看到，想要在大规模训练中利用 `torch.compile` 的人最典型的模式是 fork `torchtitan` 并将此代码库作为训练栈的基础。`torchtitan` 展示了 PyTorch 的原生功能，包括 `torch.compile`——实际上，它向你展示了如何将 PyTorch 中的功能组合在一起，以实现大规模训练。从那里开始，替换掉你有自己见解的组件，并保留你不关心的部分。

_2025年8月13日 PyTorch_
