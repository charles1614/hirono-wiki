# HarborYuan/mmcv_16: bugfix get_stream

> 原文链接: https://github.com/HarborYuan/mmcv_16/commit/ad1a72fe0cbeead2716706ff618dfa0269d2cf4c
> Authored by [HarborYuan](https://github.com/HarborYuan) · Nov 29, 2023 · commit `ad1a72f` · parent `b3f8526`

---
## Stats

1 file(s) changed · +6 / -1 (7 total lines)

## Files

### `mmcv/parallel/_functions.py`

*modified* · +6 / -1

```diff
@@ -5,6 +5,8 @@
 from torch import Tensor
 from torch.nn.parallel._functions import _get_stream
 
+from packaging import version
+
 
 def scatter(input: Union[List, Tensor],
             devices: List,
@@ -72,7 +74,10 @@ def forward(target_gpus: List[int], input: Union[List, Tensor]) -> tuple:
         streams = None
         if input_device == -1 and target_gpus != [-1]:
             # Perform CPU to GPU copies in a background stream
-            streams = [_get_stream(device) for device in target_gpus]
+            if version.parse(torch.__version__) >= version.parse('2.1.0'):
+                streams = [_get_stream(torch.device("cuda", device)) for device in target_gpus]
+            else:
+                streams = [_get_stream(device) for device in target_gpus]
 
         outputs = scatter(input, target_gpus, streams)
         # Synchronize with the copy stream
```
