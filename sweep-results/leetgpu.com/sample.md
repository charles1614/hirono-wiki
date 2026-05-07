# LeetGPU - The GPU Programming Platform

> 原文链接: https://leetgpu.com
> Learn, compete, and master GPU programming.

---
[LeetGPU](/)

[Challenges](/challenges)[Playground](/playground)[CLI](/cli)[Resources](/resources)

## Write. Run. Optimize.

Execute high-performance GPU programs instantly on real hardware in your browser.

[Start Solving](/challenges)[Open Playground](/playground)

triton.py

playground.py

Triton 3.6.0

1

2

3

4

5

6

7

8

9

import triton

import triton.language as tl

@triton.jit

def vector\_add\_kernel(a\_ptr, b\_ptr, c\_ptr, n\_elements, BLOCK\_SIZE: tl.constexpr):

    pid = tl.program\_id(axis\=0)

    offset = pid \* BLOCK\_SIZE

    mask = offset + tl.arange(0, BLOCK\_SIZE) < n\_elements

    a = tl.load(a\_ptr + offset, mask\=

#### Challenges

50+ problems covering matrix ops, memory optimization, and kernel fusion

#### Playground

Write and benchmark GPU kernels directly in your browser

#### CLI

Run jobs from your terminal with the LeetGPU command-line tool
