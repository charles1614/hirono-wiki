# ‌⁠​‌‍﻿‍​‍‬​‌​‬​​​⁠​​﻿﻿‍⁠⁠‍​﻿⁠⁠​⁠​﻿‍​‍​​​‬​​﻿‬‌﻿‌​​大模型 FIM 预训练任务是什么？

> 原文链接: https://swfvqxo30ma.feishu.cn/wiki/J4CQwxPruisyFXk599AcIdDInPh

---
大模型 FIM 预训练任务是什么？

Last modified: July 3, 2025

Share

header-v2

代码熊的大模型知识库2.4.3 生成模型LLaMA微调系列Code LLaMA大模型 FIM 预训练任务是什么？

代码熊的大模型知识库🎯从0到∞: 大语言模型知识面试一本通2\. 大语言模型架构2.4 Causal Decoder-only模型2.4.3 生成模型LLaMA微调系列Code LLaMA大模型 FIM 预训练任务是什么？

Last modified: Jul 3, 2025

Share

![](01-img_001.webp)

-   [大模型 FIM 预训练任务是什么？](#VVyIdthLjo0ivsx2fzVc1tK9n7e)
-   [1\. Fill-in-the-Middle (FIM)](#doxcnDwg72eVLKGeCCk6IkA7Yrh)
-   [2\. 最近研究](#doxcnK2hRUdkXS214N4aZdi0hHR)

#

大模型 FIM 预训练任务是什么？ ​

![](02-img_002.webp)陈麒麟

Modified July 3, 2025

​

📚

对于代码大模型，会经常遇到“填空题”的的生成任务，比如下面这个：​

def bi\_search(nums) -> bool:\\n \\n return num​

给出了函数名和最终返回结果，要求模型补全中间的内容。​

​

在 BERT 以 Encoder 为主导的时代，模型具备双向注意力机制，因此模型能够轻松地填补句子中任意位置的掩码内容，包括中间部分。​

​

而在 GPT 采用 Decoder-only 架构后，模型的注意力是单向的，仅能从左向右生成，因此无法原生地支持填充中间位置的内容。​

这就需要模型进行 Fill in the Middle 任务的训练，让自回归模型学会填充中间的内容！​

​

1.

Fill-in-the-Middle (FIM)​

传统训练模式训练的模型只能根据前文内容预测后文内容，但有些应用比如代码生成器，需要我们给出上文和下文，使模型可以预测中间的内容，传统训练训练方式就不能完成这类任务。​

OpenAI 在[《Efficient Training of Language Models to Fill in the Middle》](https://arxiv.org/pdf/2207.14255)中提出了 Fill in the Middle 的方法，以增强模型上下文感知的代码补全能力，其核心思路是：​

在期望上将训练文本均匀分布将文本分为三段：prefix、middle、suffix，然后将 middle 移动至最后，利用Suffix-Prefix-Middle（SPM）和Prefix-Suffix-Middle（PSM）两种等效模式进行提示重构。​

​

比如给出原文和对应分割：​

​

Unable to print

![Feishu Docs - Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/v2/cover/EbPybaNLbos015xGtyyc6sMwn1d/?fallback_source=1&height=1280&mount_node_token=doxcnVDeiaeGTkYIxpXF1gyFXCd&mount_point=docx_image&policy=equal&width=1280)

​

其PSM格式为：​

​

Unable to print

![Feishu Docs - Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/v2/cover/TPAUbnnF3oRGzdxsHNrcg8I4nnh/?fallback_source=1&height=1280&mount_node_token=doxcnyIqUFiBMRZxYg9P6wdcLjf&mount_point=docx_image&policy=equal&width=1280)

​

​

两个注意点：​

•

FIM 保留了prefix、middle、suffix全部三段的损失函数，即和预训练的损失计算方式统一。​

•

FIM任务和常规预训练任务混合进行，以一定的概率使用FIM。并且在不同阶段递减，比如​[Seed-Coder](https://swfvqxo30ma.feishu.cn/wiki/RAaYwrRvriuHohkLFa8cHpnunrd)在常规预训练阶段比例为0.5（以0.5的概率应用FIM），继续预训练阶段调整为0.1。​

FIM-for-free现象：OpenAI 的消融实验显示：在预训练中引入FIM机制后，对于原来的模型性能几乎没有影响。并且随着FIM比例的增加，模型在传统左到右生成上 Perplexity 不增反降，几乎免费得到 infill 能力，因此被称作 FIM-for-free 现象：​

Comments (0)

Go to the first comment

0 words
