# Why NVFP4 Inference (50 PFLOPS) Outperforms Training (35 PFLOPS) on Rubin GPU？ · Issue #2565 · NVIDIA/TransformerEngine

> 原文链接: https://github.com/NVIDIA/TransformerEngine/issues/2565

---
# Why NVFP4 Inference (50 PFLOPS) Outperforms Training (35 PFLOPS) on Rubin GPU？ #2565

[New issue](/NVIDIA/TransformerEngine/issues/new/choose)

Copy link

[New issue](/NVIDIA/TransformerEngine/issues/new/choose)

Copy link

Open

Open

[Why NVFP4 Inference (50 PFLOPS) Outperforms Training (35 PFLOPS) on Rubin GPU？](#top)#2565

Copy link

Labels

[fp4](https://github.com/NVIDIA/TransformerEngine/issues?q=state%3Aopen%20label%3A%22fp4%22)[questionFurther information is requested](https://github.com/NVIDIA/TransformerEngine/issues?q=state%3Aopen%20label%3A%22question%22)Further information is requested

[![@Yogaht](images/img_001.jpg)](https://github.com/Yogaht)

## Description

[![@Yogaht](images/img_002.jpg)](https://github.com/Yogaht)

[Yogaht](https://github.com/Yogaht)

opened [on Jan 6, 2026](https://github.com/NVIDIA/TransformerEngine/issues/2565#issue-3784927016)

Issue body actions

According to NVIDIA's official blog [Inside the NVIDIA Rubin Platform: Six New Chips, One AI Supercomputer](https://developer.nvidia.com/blog/inside-the-nvidia-rubin-platform-six-new-chips-one-ai-supercomputer/#rubin_gpu_execution_engine_for_transformer-era_ai), the 3rd Gen Transformer Engine is equipped with "hardware-accelerated adaptive compression designed to boost NVFP4 performance while preserving accuracy", which enables up to 50 PetaFLOPS of NVFP4 inference capability and 35 PetaFLOPS for training.

1.  Could you please tell me the technical mechanism of the "hardware-accelerated adaptive compression" in the 3rd Gen Transformer Engine?
2.  What are the key factors that cause the NVFP4 performance gap between training (35 PFLOPS) and inference (50 PFLOPS)?

React

## Activity

[![ptrendx](images/img_003.jpg)](https://github.com/ptrendx)

### ptrendx commented on Jan 7, 2026

[![@ptrendx](images/img_004.jpg)](/ptrendx)

[ptrendx](/ptrendx)

[on Jan 7, 2026](https://github.com/NVIDIA/TransformerEngine/issues/2565#issuecomment-3716296075)

Member

More actions

We cannot comment on the details of the unreleased hardware beyond what was disclosed in the official blog.
As for the difference in training and inference throughput, please keep in mind that even when using the same datatype (like nvfp4 in this case), there are differences in the recipes required. For example, inference in nvfp4 may use predetermined tensor-wide scaling factors obtained via calibration. In contrast, during training we need to compute that scaling factor every time a tensor is quantized. This limits the fusions that can be performed during training. Additionally, there are some operations in the nvfp4 training recipe, like Random Hadamard Transformations, which only apply to the backward pass, and therefore are not used in the inference at all. All of this means that, while the GEMM performance is the same, the actual end-to-end performance will differ between workloads.

React

[![](images/img_005.jpg)sbhavani](/sbhavani)

added

[questionFurther information is requested](/NVIDIA/TransformerEngine/issues?q=state%3Aopen%20label%3A%22question%22)Further information is requested

[fp4](/NVIDIA/TransformerEngine/issues?q=state%3Aopen%20label%3A%22fp4%22)

[on Jan 16, 2026](https://github.com/NVIDIA/TransformerEngine/issues/2565#event-22081722286)

[![YangWang92](images/img_006.jpg)](https://github.com/YangWang92)

### YangWang92 commented on Jan 17, 2026

[![@YangWang92](images/img_007.jpg)](/YangWang92)

[YangWang92](/YangWang92)

[on Jan 17, 2026](https://github.com/NVIDIA/TransformerEngine/issues/2565#issuecomment-3762606518)

More actions

> We cannot comment on the details of the unreleased hardware beyond what was disclosed in the official blog. As for the difference in training and inference throughput, please keep in mind that even when using the same datatype (like nvfp4 in this case), there are differences in the recipes required. For example, inference in nvfp4 may use predetermined tensor-wide scaling factors obtained via calibration. In contrast, during training we need to compute that scaling factor every time a tensor is quantized. This limits the fusions that can be performed during training. Additionally, there are some operations in the nvfp4 training recipe, like Random Hadamard Transformations, which only apply to the backward pass, and therefore are not used in the inference at all. All of this means that, while the GEMM performance is the same, the actual end-to-end performance will differ between workloads.

Thank you for the explanation. In the public documentation, this difference is described in terms of FLOPS, which I find a bit confusing. It seems more accurate to describe it as achievable FLOPS in training and inference?

React

[![charles1614](images/img_008.jpg)](/charles1614)

## Add a comment

new Comment

Markdown input: edit mode selected.

HeadingBoldItalicQuoteCodeLink

Unordered listNumbered listTask list

MentionReference

Slash commands

Saved replies

Add FilesPaste, drop, or click to add files

Close issue

Comment

Remember, contributions to this repository should follow its [contributing guidelines](https://github.com/NVIDIA/TransformerEngine/blob/main/CONTRIBUTING.rst) and [security policy](https://github.com/NVIDIA/TransformerEngine/security/policy).

## Metadata

## Metadata

### Assignees

No one assigned

### Labels

[fp4](https://github.com/NVIDIA/TransformerEngine/issues?q=state%3Aopen%20label%3A%22fp4%22)[questionFurther information is requested](https://github.com/NVIDIA/TransformerEngine/issues?q=state%3Aopen%20label%3A%22question%22)Further information is requested

### Type

No type

### Projects

No projects

### Milestone

No milestone

### Relationships

None yet

### Development

No branches or pull requests

### Notifications

Customize

Subscribe

You're not receiving notifications from this thread.

### Participants

[![@sbhavani](images/img_005.jpg)](/sbhavani)[![@YangWang92](images/img_009.jpg)](/YangWang92)[![@ptrendx](images/img_010.jpg)](/ptrendx)[![@Yogaht](images/img_011.jpg)](/Yogaht)[![@nvMelissa](images/img_012.jpg)](/nvMelissa)

## Issue actions

-   Give feedback
