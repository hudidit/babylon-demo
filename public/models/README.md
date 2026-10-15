# 书房旧模型的图片体积优化

`gothic_commode.glb` 和 `wooden_bookshelf.glb` 已完成资源优化阶段 B、C。两件模型保留原几何、UV、节点、材质图和采样设置，仅转换内嵌 JPEG，并重建容器的偏移、长度与对齐。

| 模型 | 原件 | 交付版本 |
| --- | ---: | ---: |
| [古董柜](gothic_commode.glb) | 24,488,264 字节 / 23.35 MiB | 1,549,376 字节 / 1.48 MiB |
| [木书架](wooden_bookshelf.glb) | 15,423,708 字节 / 14.71 MiB | 2,783,464 字节 / 2.65 MiB |
| 合计 | 38.06 MiB | 4.13 MiB，减少约 89.14% |

交付参数为 `detail-c85`：颜色 2048² / JPEG 85、金属度与粗糙度 1024² / JPEG 90、法线 1024² / JPEG 95；使用 Lanczos3 和 4:4:4，法线缩放后重新归一化。该过程有损，近景木纹的保留优于全 1K 候选，不宣称像素完全相同。

[处理清单](study-model-optimization.json) 保存原始提交、引入提交、原件及交付 SHA256、图片尺寸和编码参数、工具版本、非图片数据与材质图的源摘要。原件从 `fd32f40` 读取，候选及原件备份不进入 `public`。复现工具见 [optimize-study-models.cjs](../../tools/optimize-study-models.cjs)，实测及画面对比见 [阶段 B、C 报告](../../docs/technical-plans/assets/resource-optimization-bc-2026-10-15/README.md)。

这两件资源分别由仓库提交 `9a2d8c1`、`0e83f4c` 引入；历史记录未提供上游 URL、作者及授权信息，清单如实标为 `unverified`。它们不属于 [Poly Haven 的 CC0 来源清单](../textures/study/manifest.json)，不继承该清单的许可声明。本轮没有下载或替换其他来源的模型。
