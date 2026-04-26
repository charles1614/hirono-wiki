# deepseek技术解读(1)-彻底理解MLA（Multi-Head Latent Attention）

> 作者: 姜富春
> 发布时间: 2025-01-09 02:41・北京
> 原文链接: https://zhuanlan.zhihu.com/p/16730036197

---

## 0\. 引言

deepseek最近比较出圈，本人也一直关注deepseek发布的一些技术报告。在模型训练、推理性能和计算成本上一直能给大家惊喜。读了deepseek的技术报告，我个人有两个比较强的感受。第一：deepseek在模型细节上扣的比较极致，魔改了一些模型框架（比如模型优化方面： MLA， GRPO，MTP）；第二：工程能力上确实比较强，对于主流的一些框架和技术点能敏捷地整合到自己的系统内（比如：在Infra方面，能看到deepspeed, Megatron，DistServer、vLLM等框架的核心技术点）。后面准备用几篇笔记学习和整理下deepseek的技术。

本文重点讲解下MLA（Multi-Head Latent Attention）

> 注：我在学习的过程中，通常会有些知识盲点，或掌握不精确的地方，我会递归学习一些扩展的脉络。本文也是沿着一些必要的背景知识，逐层解读下MLH的提出背景、要解决的问题和最终的效果。

MLA主要通过优化KV-cache来减少显存占用，从而提升推理性能。直接抛出这个结论可能不太好理解。首先我们来看下，对于生成模型，一个完整的推理阶段是什么样的，推理性能上有什么问题。

## 1\. LLM模型推理过程

LLM推理分为两个阶段：**prefill阶段**和 **decode阶段**

-   **prefill阶段**：是模型对全部的Prompt tokens一次性并行计算，最终会生成第一个输出token
-   **decode阶段**：每次生成一个token，直到生成EOS（end-of-sequence）token，产出最终的response

在推理过程中，由于模型堆叠了多层transformer，所以核心的计算消耗在Transformer内部，包括MHA，FFN等操作，其中MHA要计算Q，K ，V 矩阵，来做多头注意力的计算。

在LLM生成过程中，是一个基于前向序token列预测下一个token的过程，序列中的token（无论是prefill阶段，还是decode阶段）只与它前面的token交互来计算attention，我们也称这种Attention为Causal Attention。矩阵计算上通过一个下三角的Causal Attention Mask来实现token交互只感知前向序列。如图1所示，展现的Transformer内部的细节：

![](zhihu-img-001.jpg)

图1、Transformer 内部的计算细节

我们以一个序列的 tt 位置的token为例，计算一层Tansformer的attention过程，如列下公式所示：

![](zhihu-img-002.jpg)

图2、 DeepSeek-V3 中的Attention计算公式

公式中的符号： tt 表示计算序列中第 tt 个token； q,k,v,oq,k,v,o中的两个下标，前一个表示token位置，后一个表示对应的Head下标。

从公式 （7）（7） 可以看到，在计算Attention时， tt 位置的 qq 只与 tt 位置前的 k，vk，v 做计算，所以我们有如下两个结论：

1.  计算前面的 k,vk,v 并不受后面token的影响。
2.  后面计算 t+1， t+2，...., t+nt+1， t+2，...., t+n 位置的Attention，要使用前序的 1\\to t1\\to t 位置的 k，vk，v 的值是始终不变的。

所以为了加速训练和推理的效率，在token-by-token生成过程中，避免重复计算前序的 k,vk,v 。研究者们提出把前序计算好的 k,vk,v 缓存起来，这也就是目前主流的KV-cache的机制。KV-cache本质是通过空间换时间的方法。我们知道当前LLM size都比较大，GPU的显存空间也是比较宝贵的，通过显存来保存KV-cache势必会带来访存的瓶颈。换句话说，如果不用KV-cache模型直接计算（重复计算前序 k,vk,v ），是个计算密集型任务；增加了KV-cache，现在 k,vk,v 不是通过计算得到，而是从「存储介质」里读出来，GPT内核与存储介质之间要频繁读写，这样就变成了一个访存密集型任务。所以使用了KV-cache的机制，解决的重复计算的问题，但访存的速率也就直接影响到训练和推理的速度。

接下来我们再详细看看对于一个典型的推理架构有几级访存速率，模型推理过程中又有哪些数据要做存储下来，应该如何分配存储。

## 2\. LLM推理阶段显存使用情况

### 2.1 访存速率分级

为了直观理解访存的速率，我们以一个分布式推理架构为例。

> 比如2台机器，每台机器有8张A100， 那么在这样一个系统内，卡内，单机卡间，机器之间的数据访问效率如图3所示。  
> 注：我们的例子中，只描述了一种访存介质HBM (也就是我们常说的显卡的显存)，我们知道通常GPU的存储介质除了显存，还有SRAM和DRAM。SRAM也被成为片上存储，是GPU计算单元上即时访问更快的存储，所有的计算都要先调度到片上存储SRAM才能做计算，一般只有几十M大小，带宽可达到20T/s左右，SRAM是跟计算单元强绑定的，推理阶段一般不考虑将SRAM作为存储单元使用。而DRAM是我们常说的CPU的内存，由于访问速率较慢，推理阶段一般也不考虑使用。所以我们讨论的推理存储介质，一般就指的是HBM（显存）

![](zhihu-img-003.jpg)

图3、分布式推理架构卡内、卡间、跨机存储和带宽

由上图的访存带宽可知，卡内的带宽是单机卡间的带宽的3倍，是跨机带宽的20倍，所以我们对于存储的数据应该优先放到卡内，其次单机内，最后可能才考虑跨机存储。

接下来我们再看下，推理过程中，有哪些数据要存储到显存上。

### 2.2. 模型推理阶段显存分配

下面我画了一张图，如图4所示，推理阶段主要有三部分数据会放到显存里。

-   **KV Cache** ： 如上一节所述，前序token序列计算的 k,vk,v 结果，会随着后面tokent推理过程逐步存到显存里。存储的量随着Batch，Sequence\_len长度动态变化
-   **模型参数**：包括Transformer、Embedding等模型参数会存到显存里。模型大小固定后，这个存储空间是固定的。
-   **运行时中间数据**： 推理过程中产出的一些中间数据会临时存到显存，即用即释放，一般占用空间比较小

![](zhihu-img-004.jpg)

图4. 推理阶段显存占用

由上述可知，推理阶段主要存储消耗是两部分： **模型参数**和 **KV Cache**。那么模型参数占多少，KV Cache又占多少？

首先我们先以一个token的计算过程为例，看下一个token计算要存储多少KV？为了方便理解，我们以Qwen-72B模型为例，模型配置详见： [Qwen-72B-Chat](https://huggingface.co/Qwen/Qwen-72B-Chat/blob/main/config.json)。

> 模型共80层，每层有64个Head，每个Head的向量维度是128，  
> l=80l=80 ， n\_h =64n\_h =64 ， d\_h = 128d\_h = 128  
> 注：这里先不考虑qwen 72B GQA的设置（实际KV做了压缩处理），只考虑朴素的MHA的模型结构（假设未做任何处理），GQA后面再详细讨论。

如下图5所示，计算一个token，每个Transformer层的每个Head都要存储一对 k,vk,v 。

![](zhihu-img-005.jpg)

图5、单token kv缓存数据

所以针对一个token，缓存的 k,vk,v 数据总量：

num\_{kv} =2 \* l \* n\_h = 2 \\times(80 \\times 64)\_{qwen\\\_72B} = 10240 \\tag1 num\_{kv} =2 \* l \* n\_h = 2 \\times(80 \\times 64)\_{qwen\\\_72B} = 10240 \\tag1

其中公式里的 22 表示1个 kk 和 1个 vv 。**一个token就要缓存** 1024010240 **个** k,vk,v **，这个数是不是有点意料之外！**这么多 k,vk,v 占了多少存储呢？ 我们假设模型推理阶段是半精度（bf16）参数，每个参数占2Byte。最终一个token的存储占用，如公式 (2)(2) 计算所示：

1token\\\_mem\_{kv} = 2 \* num\_{kv} \* d\_h = 2 \\times (10240 \\times 128)\_{qwen\\\_72B} = 2.62 (MB) \\tag 21token\\\_mem\_{kv} = 2 \* num\_{kv} \* d\_h = 2 \\times (10240 \\times 128)\_{qwen\\\_72B} = 2.62 (MB) \\tag 2

我们现在知道了一个Token计算后需要缓存的 k,vk,v 数量和存储量。那么对于一个实际的推理场景，还要考虑批量Batch（B）和 序列长度Sequence\_len(S) 两个维度，来确认整体KV Cache的存储消耗。这两个维度通常是可以动态变化的。我们看看下面两个场景：

**场景1：单条短文本场景**

> Batch和序列设置： B = 1 ， S = 2048。此时 k,vk,v cache总量：

mem\_{kv} = 1token\\\_mem\_{kv} \* B \* S = (2.62(MB) \\times 1\\times 2048)\_{qwen\_72B} = 5.366GB \\tag3mem\_{kv} = 1token\\\_mem\_{kv} \* B \* S = (2.62(MB) \\times 1\\times 2048)\_{qwen\_72B} = 5.366GB \\tag3

**场景2：并发长文本场景**

Batch和序列设置： B = 32 ， S = 4096。此时 k,vk,v cache总量：mem\_{kv} = 1token\\\_mem\_{kv} \* B \* S = (2.62(MB) \\times 32\\times 4096)\_{qwen\_72B} = 343.4 GB \\tag4mem\_{kv} = 1token\\\_mem\_{kv} \* B \* S = (2.62(MB) \\times 32\\times 4096)\_{qwen\_72B} = 343.4 GB \\tag4

除了 k,vk,v 消耗存储空间，我们知道模型参数也要占用存储，推理阶段模型参数占用的存储空间是固定的，计算也比较简单。假设模型参数量为： \\Phi\\Phi ，以bf16 半精度做推理，则参数量为 2\\Phi2\\Phi（Byte）。还是以qwen-72B为例，参数占用存储空间： mem\_p = 2\* \\Phi = 2 \\times (72)\_{qwen\\\_72B} = 144 G \\tag 5mem\_p = 2\* \\Phi = 2 \\times (72)\_{qwen\\\_72B} = 144 G \\tag 5

我们再结合上面两个场景，看看显存的整体分配：

-   场景1： 模型存储 mem\_p =144Gmem\_p =144G ，kv存储 mem\_{kv} = 5.366GBmem\_{kv} = 5.366GB ，模型的参数储存占主导，使用80G的A100， 至少需要2张卡做推理。
-   场景2：模型存储 mem\_p =144Gmem\_p =144G ，kv存储 mem\_{kv} = 343.4GBmem\_{kv} = 343.4GB ，KV Cache储存占主导，使用80G的A100， 至少需要7张卡做推理。

> 这里还要多啰嗦几句，推理阶段根据离线、在线的业务场景，到底组多大的Batch，其实是一个Balance的过程，Batch选择比较小，虽然并发度不高，但可能单卡就能装下完整模型参数和KV Cache，这时候卡内带宽会比较高，性能可能依然出众，可以考虑适当增加Batch把单卡显存用满，进一步提升性能。但当Batch再增大，超出单卡范围、甚至超出单机范围，此时并发会比较大，但跨卡或跨机访存性能会降低，导致访存成为瓶颈，GPU计算资源使用效率不高，可能实际导致整体推理性能不高。所以单从推理Batch设置角度来看，要实测找到性能最佳的平衡点。

当前LLM都比较大，而访存的容量和访存速率有分级的特点。所以推理过程中，减少跨卡、卡机的访存读写是优化推理性能的一个有效路径。一方面单次读写的数据越少，整体速度会越快；另一方面整体显存占用越少，就能尽量把数据放到单卡或单机上，能使用更高的带宽读写数据。

本文要学习的MLA就是通过减少KV Cache来压缩显存占用，从而优化推理速度。我们在展开了解MLA之前，先看看当前有哪些优化KV Cache的方法。

## 3\. 减小KV cache的方法

### 3.1. KV Cache 优化方法汇总

业界针对KV Cache的优化，衍生出很多方法，这里我根据自己的积累，稍微总结下，只简单描述优化的思路，不过多展开。

**方法主要有四类**：

1.  **共享KV**：多个Head共享使用1组KV，将原来每个Head一个KV，变成1组Head一个KV，来压缩KV的存储。代表方法：GQA，MQA等
2.  **窗口KV**：针对长序列控制一个计算KV的窗口，KV cache只保存窗口内的结果（窗口长度远小于序列长度），超出窗口的KV会被丢弃，通过这种方法能减少KV的存储，当然也会损失一定的长文推理效果。代表方法：Longformer等
3.  **量化压缩**：基于量化的方法，通过更低的Bit位来保存KV，将单KV结果进一步压缩，代表方法：INT8等
4.  **计算优化**：通过优化计算过程，减少访存换入换出的次数，让更多计算在片上存储SRAM进行，以提升推理性能，代表方法：flashAttention等

本文要讨论的MLA是共享KV分支下的一种优化方法，下面我们先展开看看共享KV方法有哪些，这些方法也是MLA拿来对比的方法。

### 3.2. 共享KV优化显存方法

共享KV主要有两种方法，MQA和GQA都是Google提出的，详见： [MQA(2019)](https://arxiv.org/pdf/1911.02150)，[GQA(2023)](https://arxiv.org/pdf/2305.13245)，如图6所示。

![](zhihu-img-006.jpg)

图6、KV Cache优化方法- 共享KV方法

**3.2.1. MQA（Multi-Query Attention）**

MQA方法比较简单，详见上图6最右侧的图，每一层的所有Head，共享同一个 k,vk,v 来计算Attention。相对于MHA的单个Token需要保存的KV数（ 2 \* l \* n\_h2 \* l \* n\_h ）减少到了（ 2 \\times l2 \\times l ）个，即每一层共享使用一个 kk 向量和一个 vv 向量

**3.2.2. GQA（Group-Query Attention）**

GQA是平衡了MQA和MHA的一种折中的方法，不是每个Head一个KV，也不是所有Head共享一个KV，而是对所有Head分组，比如分组数为 gg ，那么每组： n\_h/gn\_h/g个Head 共享一个KV。当 g=1g=1 时，GQA就等价于MQA，当 g=n\_hg=n\_h时， GQA就等价于MHA。

为了方便自己更清晰的理解GQA和MQA ，我还是以一个Token计算KV过程（如图5），画了一些相对细节展开的图，把所有层都画出来，并且加了一些注释。如图7所示：

![](zhihu-img-007.jpg)

图7、MHA，MQA，GQA KVcache对比图

我们再总结下单token计算下，几种方法KV Cache的存储量（模型层数： ll ，每层Head数量： n\_hn\_h ）

-   MHA共缓存 2 \\times l \\times n\_h2 \\times l \\times n\_h 个 k,vk,v
-   MQA共缓存 2 \\times l 2 \\times l 个 k,vk,v
-   GQA共缓存 2 \\times l \\times g2 \\times l \\times g 个 k,vk,v ， gg 是分组数， 1 \\le g \\le n\_h1 \\le g \\le n\_h， 一般取值能被 n\_hn\_h 整除

本文要讲的MLA也是一种优化共享KV优化的变体，下面我们看看MLA的原理和细节

## 4\. MLA

### 4.1. MLA KV优化速览

我们先走马观花看看MLA的计算方式和与MQA、GQA的压缩KV的效果对比。

首先我们看看MLA计算Attention的完整公式，如下图8所示

![](zhihu-img-008.jpg)

图8、MLA Attention计算公式

在论文中提到，每个Transformer层，只缓存了上述公式蓝框的向量： c\_t^{KV}c\_t^{KV} 和 k\_t^Rk\_t^R ，这两个向量的大小分别为：

c\_t^{KV} c\_t^{KV} : 维度为 d\_c = 4 \\times d\_h =512d\_c = 4 \\times d\_h =512

k\_t^Rk\_t^R ：维度为 d\_h^R = d\_h /2 = 64d\_h^R = d\_h /2 = 64

对比MQA（每层有一个 d\_hd\_h 维度的 kk 和 一个 d\_hd\_h 维度的 vv ，共 2d\_h2d\_h 个元素），MLA相当于增加了2.25倍的存储，但DeepSeek描述自己的方法不仅比MQA强，而且比非共享KV的原始MHA也要强，后面4.4节我们在展开讨论。

MLA号称又快又省又强大，下一节我们逐步看看具体的实现。

### 4.2. MLA原理解读

下面我们参照图8的公式看看MHA的计算过程，首先对图中公式的变量做如下解释说明：

-   d\_cd\_c ：MLA低秩压缩的维度，论文中取值： d\_c = 4 \\times d\_hd\_c = 4 \\times d\_h
-   d\_hd\_h ：是单个head的向量维度
-   n\_hn\_h ：是每层head的数量
-   dd ：隐层维度， d = d\_h \\times n\_hd = d\_h \\times n\_h
-   W^{DKV} \\in \\mathbb{R}^{d\_c \\times d}W^{DKV} \\in \\mathbb{R}^{d\_c \\times d} 是低秩变换矩阵

**1\. 先看下KV的计算过程**

-   首先公式（41）对输入 h\_th\_t 做一个低秩压缩，将 dd维的输入经过 W^{DKV}W^{DKV} 变换后压缩成 d\_cd\_c维的 c\_t^{KV}c\_t^{KV} 。DeepSeek-V3中 d = 7168d = 7168 ， d\_c= 512d\_c= 512

![](zhihu-img-009.jpg)

-   然后通过公式（42）和公式（45）两个变换矩阵（ W^{UK} , W^{UV} \\in \\mathbb R^{d\_hn\_h \\times d\_c}W^{UK} , W^{UV} \\in \\mathbb R^{d\_hn\_h \\times d\_c} ），将KV的维度扩展回d = d\_h n\_hd = d\_h n\_h ，也就是每个Head有一个单独的 k,vk,v （跟MHA的KV数量一致）

![](zhihu-img-010.jpg)

![](zhihu-img-011.jpg)

> 注：经过上述的变换，非常类似LoRA做低参数微调的逻辑。通过两个低秩矩阵先做压缩、再做扩展，最终能降低参数的数量。但MLA本质是要做到减少KV-cache的存储。LoRA强调的是参数量的减少，类似MLA这操作确实也减少了参数量，按DeepSeek-V3的参数配置，两个低秩矩阵参数量： 2 \\times d\_c \\times d = 2 \\times 512 \\times 7168 2 \\times d\_c \\times d = 2 \\times 512 \\times 7168 *，而正常MHA的参数矩阵参数量：* d \\times d = 7168 \\times 7168d \\times d = 7168 \\times 7168 。但MLA强调的是KV-cache的减少，也就是KV的激活值减少。当前我们还看不出来怎么减少激活值的数量的，因为单从KV的数量和维度上看跟MHA是一个量级，比GQA和MQA都要多，同时计算又多了一步。当前是比较迷糊的...我们再往下继续看...

**2\. 再看下Q的计算过程**

-   公式（37），（38）类似KV的逻辑，通过两个矩阵（ W^{DQ}, W^{UQ} \\in \\mathbb R^{d\_hn\_h \\times d\_q}W^{DQ}, W^{UQ} \\in \\mathbb R^{d\_hn\_h \\times d\_q} ）也做了一层低秩变换，这一步Q的变换看着趋是为了减少模型的参数的数量。在Deepseek-V3里 d\_q = 1536d\_q = 1536 。是KV压缩维度 d\_cd\_c 的3倍。但相对于 d = 7168d = 7168 还是压缩了不少。

![](zhihu-img-012.jpg)

**3\.** q,kq,k **增加Rope位置编码**

-   我们注意到在增加RoPE位置编码并没有在上述计算出的 q\_t^C,k\_t^Cq\_t^C,k\_t^C 的基础上乘以Rope的对角矩阵。而是单独计算了两个带着位置编码的 q\_t^R, k\_t^Rq\_t^R, k\_t^R 如公式（39）和公式（43）所示

![](zhihu-img-013.jpg)

![](zhihu-img-014.jpg)

> **注意这里计算带RoPE的** q\_t^R, k\_t^Rq\_t^R, k\_t^R **有两个细节**：  
> 1\. q\_t^R, k\_t^Rq\_t^R, k\_t^R 的向量维度 d\_h^Rd\_h^R 是个比较小的维度，DeepSeek设置为单Attention Head维度的一半： d\_h^R = d\_h /2 = 64d\_h^R = d\_h /2 = 64  
> 2\. 这部分计算的 k\_t^Rk\_t^R 实际是个MQA的计算方式，同一层中，所有的Head共享同一个 kk

-   然后按如下公式（40），（44）跟已经计算的 q\_t^C,k\_t^Cq\_t^C,k\_t^C 拼接，构成完整的 q\_t,k\_tq\_t,k\_t 向量。

> 注：这里的下标 ii 表示Attention Head的索引

![](zhihu-img-015.jpg)

![](zhihu-img-016.jpg)

所以到目前为止，我们得到的 q,kq,k包括两部分拼接而成：一部分是做了低秩压缩得到的 q,kq,k 向量，一部分是增加了RoPE位置编码的 q,kq,k 向量。（后面这部分向量是基于MQA方式计算得到的，所有Head共享1个 kk ）。

如何理解上述的操作过程？**这也是MLA方法的核心。**

**我们先来看看DeepSeek-V2论文中有一段原文解释（中文翻译）**：

> 位置编码使用RoPE，但RoPE与低秩KV不兼容。具体来说，RoPE对Q和K都是位置敏感的。如果我们为 k\_t^Ck\_t^C 应用RoPE，那么公式（42）的 W ^{ }W ^{ } （K的权重矩阵）将与位置敏感的RoPE矩阵耦合。因此，在推理过程中， W^{UK}W^{UK} 无法再被吸收到 W^{UQ}W^{UQ} （Q的权重矩阵）中，因为与当前生成的token相关的RoPE矩阵将位于 W^{UQ}W^{UQ} 和 W^{UK}W^{UK} 之间，而矩阵乘法不满足交换律。因此，我们必须在推理过程中重新计算所有前缀token的k，这将极大地降低推理效率。

论文中提到了「矩阵吸收计算」，这个概念对理解MLA比较重要，我们用一个简单的例子理解下：

> 假设有两个向量变量 x\_1,x\_2 \\in R^{3 \\times1}x\_1,x\_2 \\in R^{3 \\times1} 都是3维的向量。有两个固定的变换矩阵 P，Q \\in R^{2 \\times 3}P，Q \\in R^{2 \\times 3} 分别对 x\_1, x\_2x\_1, x\_2 做线性变换得到新的向量 x\_1^{'},x\_2^{'}x\_1^{'},x\_2^{'} 。最终求 x\_1^{'},x\_2^{'}x\_1^{'},x\_2^{'} 两个向量的乘积。  
> **方法1： 常规计算**  
> x\_1^{'} = Px\_1 \\tag ax\_1^{'} = Px\_1 \\tag a  
> x\_2^{'}= Qx\_2 \\tag bx\_2^{'}= Qx\_2 \\tag b  
> x\_1^ {'T} x\_2^{'} = (Px\_1)^T \*(Qx\_2) = x\_1^T P^T Q x\_2 \\tag cx\_1^ {'T} x\_2^{'} = (Px\_1)^T \*(Qx\_2) = x\_1^T P^T Q x\_2 \\tag c  
> **方法2：矩阵吸收计算**  
> 我们知道矩阵乘法是满足结合律的，对于公式 (c)(c) 我们可以先计算好两个变换矩阵的乘积：  
> Q^{'}= P^T Q \\tag dQ^{'}= P^T Q \\tag d  
> 然后通过 Q^{'}Q^{'} 与 x\_2x\_2 相乘，计算出 x\_2^{''}x\_2^{''} ，而 x\_1x\_1 则不做任何操作  
> x\_2^{''} = Q^{'} x\_2 \\tag ex\_2^{''} = Q^{'} x\_2 \\tag e  
> 再计算 x\_1x\_1 和 x\_2^{''} x\_2^{''} 乘积  
> x\_1^T x\_2^{''} = x\_1^{T}Q^{'} x\_2 = x\_1^T P^T Q x\_2 = x\_1^ {'T} x\_2^{'} \\tag fx\_1^T x\_2^{''} = x\_1^{T}Q^{'} x\_2 = x\_1^T P^T Q x\_2 = x\_1^ {'T} x\_2^{'} \\tag f

通过上面的例子我们可以看到，两种方法计算出的结果是一样的，但第二种方法是先做了矩阵乘法，**相当于把** x\_1x\_1 **的变换矩阵** PP **吸收到了** x\_2x\_2 **的变换矩阵** QQ **里。**

理解了上面的例子，我们再来看看原文说的「**RoPE与低秩KV不兼容，没法做矩阵吸收计算**」的问题。

**a) 不加RoPE**

我们先假设当前不增加RoPE，那么 q,kq,k 乘积计算如下，其中(i)(i) 表示变换矩阵第 ii 个Head的切片：

q\_{t,i}^T \\times k\_{j,i} = (W\_{(i)}^{UQ} c\_t^Q)^T \\times W\_{(i)}^{UK}c\_j^{KV} = (c\_t^Q)^T\\times (W\_{(i)}^{UQ})^TW\_{(i)}^{UK} \\times c\_j^{KV} \\tag 6q\_{t,i}^T \\times k\_{j,i} = (W\_{(i)}^{UQ} c\_t^Q)^T \\times W\_{(i)}^{UK}c\_j^{KV} = (c\_t^Q)^T\\times (W\_{(i)}^{UQ})^TW\_{(i)}^{UK} \\times c\_j^{KV} \\tag 6

**不加RoPE，我们可以提前计算好** (W\_{(i)}^{UQ})^TW\_{(i)}^{UK} (W\_{(i)}^{UQ})^TW\_{(i)}^{UK} **， 也就上面说的** W^{UK}W^{UK} **吸收到** W^{UQ}W^{UQ} **中，**这样在做 qq 的变换的时候，也就同时计算了 W^{UK}W^{UK} 矩阵的乘法**。**

**这样的好处是，我们只需要缓存** c\_j^{KV}c\_j^{KV} **，而不是缓存** W\_{(i)}^{UK} \\times c\_j^{KV}W\_{(i)}^{UK} \\times c\_j^{KV} 的结果。 c\_j^{KV} c\_j^{KV} 维度只有 4d\_h4d\_h的长度，而 W\_{(i)}^{UK} \\times c\_j^{KV}W\_{(i)}^{UK} \\times c\_j^{KV} 是个 4d\_h \\to d4d\_h \\to d 的变换，也就是完全恢复了隐层的维度 d = d\_h \* n\_h =64d\_hd = d\_h \* n\_h =64d\_h (DeepSeek-v3 n\_hn\_h 配置为64)。**这也是MLA的压缩KV Cache的核心原理。**

**b) 现在假设增加RoPE**

我们再看看，加上Rope后，计算 q,kq,k 乘积，会在 (W\_{(i)}^{UQ})^T (W\_{(i)}^{UQ})^T 和 W\_{(i)}^{UK} W\_{(i)}^{UK} 之间，增加一个融合了相对位置的变量 \\mathcal R\_{t-j}\\mathcal R\_{t-j} ，如公式（2）所示：

q\_{t,i}^T \\times k\_{j,i} = (\\mathcal R\_tW\_{(i)}^{UQ} c\_t^Q )^T \\times \\mathcal R\_j W\_{(i)}^{UK}c\_j^{KV}= (c\_t^Q)^T\\times (W\_{(i)}^{UQ})^T\\mathcal R\_t^T\\mathcal R\_j W\_{(i)}^{UK} \\times c\_j^{KV} = (c\_t^Q)^T\\times (W\_{(i)}^{UQ})^T\\mathcal R\_{t-j} W\_{(i)}^{UK} \\times c\_j^{KV} \\tag 7q\_{t,i}^T \\times k\_{j,i} = (\\mathcal R\_tW\_{(i)}^{UQ} c\_t^Q )^T \\times \\mathcal R\_j W\_{(i)}^{UK}c\_j^{KV}= (c\_t^Q)^T\\times (W\_{(i)}^{UQ})^T\\mathcal R\_t^T\\mathcal R\_j W\_{(i)}^{UK} \\times c\_j^{KV} = (c\_t^Q)^T\\times (W\_{(i)}^{UQ})^T\\mathcal R\_{t-j} W\_{(i)}^{UK} \\times c\_j^{KV} \\tag 7

**中间这个分量** (W\_{(i)}^{UQ})^T\\mathcal R\_{t-j} W\_{(i)}^{UK} (W\_{(i)}^{UQ})^T\\mathcal R\_{t-j} W\_{(i)}^{UK} **是随这相对位置变化而变化的，并不是个固定的矩阵，因此并不能提前计算好。所以论文中说RoPE与低秩变换不兼容。**

**c）通过增加一个很小** q,kq,k **分量，引入RoPE**

为了引入位置编码，作者在一个很小维度下，用MQA方式计算了 q,kq,k ，也就是在每层网络中，所有Head只计算一个 kk （如论文中公式43所示）。引入位置编码的向量维度取的比较小为： d\_h /2 = 128/2 = 64d\_h /2 = 128/2 = 64 。

所以最终 q,kq,k 向量通过两部分拼接而成，计算权重时，由前后两部分分别相乘再相加得到，如下公式（8）所示：

q\_{t,i}^T \\times k\_{j,i} = \[q\_{t,i}^C; q\_{t,i}^R\]^T \\times \[k\_{j,i}^C; k\_t^R\] = q\_{t,i}^Ck\_{j,i}^C + q\_{t,i}^R k\_t^R \\tag 8q\_{t,i}^T \\times k\_{j,i} = \[q\_{t,i}^C; q\_{t,i}^R\]^T \\times \[k\_{j,i}^C; k\_t^R\] = q\_{t,i}^Ck\_{j,i}^C + q\_{t,i}^R k\_t^R \\tag 8

前一项 q\_{t,i}^Ck\_{j,i}^Cq\_{t,i}^Ck\_{j,i}^C 按公式（6）计算，通过矩阵吸收处理，全Head只缓存一个 c\_t^{KV}c\_t^{KV} ，后一项 q\_{t,i}^R k\_t^Rq\_{t,i}^R k\_t^R 按正常MQA的方式计算，全Head只缓存了一个共享 kk 。

通过类似的计算方式，可以处理将 vv 的变换矩阵 W^{UV} W^{UV} 吸收到最终的结果变换矩阵 W^OW^O 中，这样也不用实际计算和缓存 vv 的值。而是只缓存跟 kk 一样的 c\_t^{KV} c\_t^{KV} 即可，详细推导与上述类似，不过多赘述。

上面我们就完整介绍了MLA做KV Cache压缩的原理。我们再来回顾下，MLA实际缓存的向量（如图8蓝色框），维度如下：

-   c\_t^{KV} c\_t^{KV} ：维度为 4 \\times d\_h =5124 \\times d\_h =512
-   k\_t^Rk\_t^R：维度为 d\_h /2 = 64d\_h /2 = 64

c\_t^{KV} c\_t^{KV} 是低秩压缩的向量， k\_t^Rk\_t^R 是引入位置编码的MQA范式计算的共享 kk

> 注：原理篇其实苏神已经解释的非常清晰了（详见：[缓存与效果的极限拉扯：从MHA、MQA、GQA到MLA - 科学空间|Scientific Spaces](https://spaces.ac.cn/archives/10091)），本文原理的部分也基本按苏神的逻辑概述下关键思路，感谢苏神的分享

### 4.3. MLA与MQA、GQA对比

最后我们再简单看看几种方法的对比，直接截取DeepSeeku-V2论文的图，如下：

![](zhihu-img-017.jpg)

图9、MLA，MHA，GQA，MQA对比图

从上图我们可以看到，虽然MLA缓存的Latent KV比较短（相当于2.25个MQA的缓存量），但MLA有恢复全 k,vk,v 的能力，特征表达能力显著比GQA、MQA要强。所以MLA能做到又快又省又强。论文中也给出了下图的数据

![](zhihu-img-018.jpg)

图10、MLA与其他方法压缩性能和效果对比

> 注：图中能力的比较上，描述比MHA更强我比较存疑，并没看到有消融的实验对比，也不太好从原理上解释。

## 5\. 总结

本文试图通过引入更多基础知识和辅助信息，来深入理解MLA。内容比较长，可能觉得比较啰嗦。这是本人在理解MLA过程递归总结的一些扩展信息，最终整理了一个系统的脉络，发出来供大家参考。

## **6.参考文献**

1.  deepseek-v1**:**[https://arxiv.org/pdf/2401.02954](https://arxiv.org/pdf/2401.02954)
2.  deepseek-v2:[https://arxiv.org/pdf/2405.04434](https://arxiv.org/pdf/2405.04434)
3.  deepseek-v3:[https://arxiv.org/pdf/2412.19437](https://arxiv.org/pdf/2412.19437)
4.  [缓存与效果的极限拉扯：从MHA、MQA、GQA到MLA - 科学空间|Scientific Spaces](https://spaces.ac.cn/archives/10091)
5.  [https://zhuanlan.zhihu.com/p/659770503](https://zhuanlan.zhihu.com/p/659770503)
6.  GQA:[https://arxiv.org/pdf/2305.13245](https://arxiv.org/pdf/2305.13245)
7.  MQA:[https://arxiv.org/pdf/1911.02150](https://arxiv.org/pdf/1911.02150)

个人水平有限，欢迎指正~
