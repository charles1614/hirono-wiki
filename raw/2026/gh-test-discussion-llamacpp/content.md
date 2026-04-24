# Incoming backends: Vulkan, Kompute, SYCL · ggml-org/llama.cpp · Discussion #5138

> 原文链接: https://github.com/ggml-org/llama.cpp/discussions/5138

---

## ggerganov

> opened this discussion on Jan 26, 2024 · Member

ref:

- Vulkan: https://github.com/ggerganov/llama.cpp/pull/2059 (@0cc4m)
- Kompute: https://github.com/ggerganov/llama.cpp/pull/4456 (@cebtenzzre)
- SYCL: https://github.com/ggerganov/llama.cpp/pull/2690 (@abhilash1910)

There are 3 new backends that are about to be merged into `llama.cpp`. The tentative plan is do this over the weekend. Due to the large amount of code that is about to be merged, I'm creating this discussion for a quick communication channel between the maintainers in case problems arise.

The main goal after merging the backends is to make the CI green which would give some level of confidence that the existing stuff has not been broken. Even if the new backends don't function completely as expected, this would be acceptable as the idea is to improve over these with time. However, we want the CPU, CUDA and Metal backends to remain stable.

I'm thinking to do the merges all at once (in a batch) and sync everything back to the `ggml` and `whisper.cpp` repos.

If you have any general comments / questions we can discuss here. I will keep high attention to the discussion until we finalize the merges. Will also put it in the readme for awareness. We can discuss code specifics in the respective PRs as usual and keep this discussion focused on high-priority stuff (if needed)

## LostRuins

> commented on Jan 26, 2024 · Collaborator

I've mentioned it elsewhere, and this is only tangentially related, but currently GPU offload with OpenCL backend is pretty broken right now, ever since the backend rework. Model architectures for Phi, Mixtral and Falcon all no longer working as Slaren explained here: https://github.com/ggerganov/llama.cpp/pull/2059#issuecomment-1902698632

I'm not sure what operations each of these new backends will support, but I would just like to +1 Slaren's suggestion where "weights not supported by a backend are kept on the CPU instead", which would hopefully allow graceful performance degradation versus just segfaulting.

## ggerganov

> replied on Jan 26, 2024 · Member

The OpenCL needs a complete overhaul as a `ggml` backend, similar to what is done with the referenced backends here. The OpenCL matrix multiplication offloading was a poor man's hack that resulted in some performance gains and was nice to have at the start, but we cannot keep working around it. It has to either be reimplemented properly as a backend or we will eventually drop support for OpenCL all together, even more so that we are now about to add Vulkan.

Keeping the un-supported weights on the CPU would be nice-to-have, but as it was mentioned - it is low priority at the moment.

## qnixsynapse

> commented on Jan 26, 2024 · Collaborator

It would be interesting to see how does the Vulkan backend work on Android. 

I wish the Vulkan API gains support for NPUs in modern hardware chipsets, if it doesn't. (ahem Samsung galaxy AI s24)..

## StuartIanNaylor

> replied on Jan 27, 2024

Isn't it a matter of vendors writing Vulkan drivers for supported ops?
Its a shame there isn't a Linux NNapi as Android has, but Vulkan and likely dropping OPenCL might be the way to go, but even ArmNN uses OpenCL and its a landscape with acne.

## qnixsynapse

> replied on Jan 27, 2024 · Collaborator

@StuartIanNaylor I think vendors will write drivers once such "extensions" becomes part of the "official Vulkan specification". A proposal for such extension/extensions need to be filed which will get reviewed. Once it is accepted, then vendors will eventually adopt it.

## sorasoras

> replied on Jan 27, 2024

Or better.
Vendor accelerate some ops  that use by machine learning directly when using Vulkan.

## StuartIanNaylor

> replied on Jan 27, 2024

https://github.com/airockchip/rknn-toolkit2/blob/master/rknpu2/runtime/Linux/librknn_api/include/rknn_matmul_api.h

I dunno is it possible to just do a universal mat/mul?

## VelvetyWhite

> commented on Jan 28, 2024

Really nice, I'm curious if any of these vulkan implementations will work with raspberry pi 5. Would be nice to take advantage of its gpu. 🤔

## 0cc4m

> replied on Jan 28, 2024 · Contributor

Does it have a working Vulkan driver?

## Nindaleth

> replied on Jan 28, 2024 · Contributor

Yes, RPi5 running Raspbian (i.e. Raspberry Pi OS nowadays) is officially Vulkan 1.2 conformant: https://www.khronos.org/conformance/adopters/conformant-products#submission_754

## 0cc4m

> replied on Jan 28, 2024 · Contributor

That's very cool. If someone can send me the `vulkaninfo` output of the RPi5 I can provide more information about whether it should/could work.

## VelvetyWhite

> replied on Jan 28, 2024

Here is the output of `vulkaninfo` from a RPI5
[vulkaninfo.txt](https://github.com/ggerganov/llama.cpp/files/14075902/vulkaninfo.txt)

## StuartIanNaylor

> replied on Jan 28, 2024

Likely not worth it, I have a RK3588 and the MaliG610 manages about 75% of the ML workload of all 4 cores.
Even with the MaliG610 as its only a MP4 but much faster than VC (Raspberry spec shows VC gflops on VC but doesn't show the effect of marshalling to the CPU ram space).
Running layers on the MaliG610 is slower but still could help the CPU but if your trying on a Pi don't blame Vulkan as the GPU isn't in the same league as its A76 cores.

## 0cc4m

> replied on Jan 28, 2024 · Contributor

It could work, I think the VC Vulkan driver has all the parts that it needs.

## mschwaig

> replied on Jan 29, 2024 · Contributor

I tried to run the latest commit (e76627bcce9f77adb6034cb127b7ec93d4287b69) on a Pixel 7a with GrapheneOS using Termux and it segfaulted.
```
~/llama.cpp $ ./llama-bench -m phi-2.Q4_K_M.gguf
ggml_vulkan: Using Mali-G710 | fp16: 1 | warp size: 16
| model | size | params | backend | ngl | test | t/s |
| ------------------------------ | ---------: | ---------: | ---------- | --: | ---------- | ---------------: |
Segmentation fault
```
The GPU being detected seems like a good sign to me. ~I have not yet tried that exact same model with the Vulkan backend on my desktop system  though.~

Here's the [vulkaninfo output](https://github.com/ggerganov/llama.cpp/files/14084786/vulkaninfo.txt) if anyone's interested.

## sirus20x6

> commented on Jan 29, 2024 · Contributor

can the sycl backend be used with AMD cards? also can the sycl backend let me use cpu and gpu?

## Artefact2

> commented on Jan 29, 2024 · Contributor

Some benchmarks of Vulkan and Kompute on 6750XT/5800X3D. (Model is SOLAR 10.7B Q4_1.)

| model                          |       size |     params | backend    | threads/ngl | test       |              t/s |
| ------------------------------ | ---------: | ---------: | ---------- | ---------: | ---------- | ---------------: |
| llama 34B Q4_1                 |   6.27 GiB |    10.73 B | ROCm       |  99 | pp 512     |    673.96 ± 0.77 |
| llama 34B Q4_1                 |   6.27 GiB |    10.73 B | Vulkan     |  99 | pp 512     |    209.35 ± 1.29 |
| llama 34B Q4_1                 |   6.27 GiB |    10.73 B | Kompute    |          8 | pp 512     |     72.77 ± 0.05 |
| llama 34B Q4_1                 |   6.27 GiB |    10.73 B | OpenCL     |  99 | pp 512     |    112.41 ± 0.79 |
| llama 34B Q4_1                 |   6.27 GiB |    10.73 B | CPU        |          8 | pp 512     |     15.72 ± 3.43 |
| llama 34B Q4_1                 |   6.27 GiB |    10.73 B | ROCm       |  99 | tg 128     |     40.30 ± 0.01 |
| llama 34B Q4_1                 |   6.27 GiB |    10.73 B | Vulkan     |  99 | tg 128     |     17.52 ± 0.03 |
| llama 34B Q4_1                 |   6.27 GiB |    10.73 B | Kompute    |          8 | tg 128     |     35.48 ± 0.04 |
| llama 34B Q4_1                 |   6.27 GiB |    10.73 B | OpenCL     |  99 | tg 128     |     14.86 ± 0.04 |
| llama 34B Q4_1                 |   6.27 GiB |    10.73 B | CPU        |          8 | tg 128     |      6.35 ± 0.00 |

## cebtenzzre

> replied on Jan 29, 2024 · Collaborator

Is it SOLAR 10.7B or llama 34B? And are you using 8 layers for Kompute, or 99? Which llama.cpp commit(s) are you testing on?

## Artefact2

> replied on Jan 29, 2024 · Contributor

Model is SOLAR 10.7B Q4_1. Kompute mis-reports in `llama-bench` as CPU with 8 threads, but it's fully offloading to the GPU.

## 0cc4m

> replied on Jan 30, 2024 · Contributor

I think my Vulkan backend doesn't like non-k-quants at the moment. I've seen some improvements to the cuda quantized Matrix-Vector shaders added recently that could be ported to Vulkan.

## sorasoras

> replied on Jan 30, 2024

Your backend is quite a bit slower at Q2K than at Q4KM,Which is kind of interesting.

## PrestigeDevop

> commented on Jan 30, 2024

hmm, not sure if this  already implemented or not  , but inference ML task in Compute shader should improve performance .
also for arm based v8a  some soc support Neom intrinsics technology .

## sorasoras

> replied on Jan 30, 2024

I don't know what you mean but Vulkan api backend is basically inference on compute shader.

# Incoming backends: Vulkan, Kompute, SYCL #5138

[ggerganov](/ggerganov) announced in [Announcements](/ggml-org/llama.cpp/discussions/categories/announcements)
