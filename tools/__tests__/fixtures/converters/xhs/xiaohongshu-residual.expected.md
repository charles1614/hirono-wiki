# 我们撞车了Kimi的注意力残差，但用在压缩上

> 原文链接: https://www.xiaohongshu.com/discovery/item/69b8157a000000002200dde0?xsec_token=CBnQYqpHWeCxpsmKaCmSL9HYC_j0YrJgSrIHLU6Mghkfs=&app_platform=ios
> 作者: Winters
> 互动: 193 likes · 208 collects · 5 comments

---

今天看到Kimi的Attention Residuals，发现和我们前段时间在上下文压缩上的文章 "Context Compression via Explicit Information Transmission" 共享了一样的【直觉】和【解决方法】。

🔆【相似的问题直觉】目前的context compression都采用“将LLM训练成压缩器”范式，不可避免的会遇到Kimi中指出的层之间的渐进稀释问题"progressively diluting each layer’s contribution"，在我们的paper中以相同的直觉"progressive representation overwriting across layers"提出了这个问题 【图2】。深层的抽象特征会覆盖和稀释中前层提取的值得被保留和压缩的特征，造成压缩器的输出和LLM输入之间更大的分布差异。

🔆【相似的解决方法】我们基于LLM forward pass后的特征已经蕴含大量压缩信息的直觉，也提出用残差注意力直接提取LLM的hidden states而不训练LLM的范式【图1】，让压缩层能够直接绕过稀释过程，直接利用和筛选每一层的信息，构造压缩表征。 残差注意力也提供了一定的可解释性信息，告诉我们对于不同的token，压缩器如何选择层间信息。同时我们还提出用Optimal Transport解决压缩注意力缺乏合理分配的冗余问题。

🔆【启发】我们发现这个范式的效果非常好，并且训练的收敛速度很快。我们还发现残差注意力倾向于筛选中前层的信息【图4】，表明深层信息确实不适合被压缩保留，说明了残差注意力结构的重要性。这个结构也打开了更大的设计空间，使得我们不必受困于为了压缩而对self-attention魔改，而把LLM当作特征抽取器。希望大家能基于此继续探索，找到更好的上下文压缩结构！

**标签 / Tags:** #大模型, #Kimi, #注意力机制, #上下文压缩

## Images

![69b8157a000000002200dde0_01.jpg](69b8157a000000002200dde0_01.jpg)
![69b8157a000000002200dde0_02.jpg](69b8157a000000002200dde0_02.jpg)
![69b8157a000000002200dde0_03.jpg](69b8157a000000002200dde0_03.jpg)
![69b8157a000000002200dde0_04.jpg](69b8157a000000002200dde0_04.jpg)
