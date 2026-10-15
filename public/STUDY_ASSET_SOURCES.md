# 书房发布资源来源

本目录只包含当前书房运行素材、生产页面与全部动态调试分包。文件摘要和字节数见 [发布清单](release-manifest.json)。各类素材的许可状态独立记录。

## Poly Haven 素材

地板 `wood_floor`、木材 `wood_table_001`、墙砖 `brick_wall_001`、亚麻 `rough_linen`、沙发 `sofa_03`、扶手椅 `modern_arm_chair_01` 和环境 `brown_photostudio_01` 的来源、作者、下载 URL、原件摘要及处理方式见 [来源清单](textures/study/manifest.json)。这些素材按来源记录使用 [CC0-1.0](https://polyhaven.com/license)。清单中 `public/` 前缀对应开发仓库，发布路径去掉该前缀；模型的 `sourceFiles` 为上游文件记录，不是额外运行依赖。

窗景来自 Andreas Mischok 的 [Forest Slope](https://polyhaven.com/a/forest_slope)，按来源记录为 CC0-1.0；经过透视重投影及 JPEG 编码。原件、交付摘要及参数见 [窗景处理记录](textures/study/forest-window/source.json)。

## 仓库已有素材

- `models/gothic_commode.glb`、`models/wooden_bookshelf.glb`：仓库引入提交分别为 `9a2d8c1`、`0e83f4c`，未记录上游、作者及许可，状态为 `unverified`。本轮只压缩内嵌 JPEG，保留几何、UV、节点与材质；详见 [独立处理记录](models/study-model-optimization.json)。两件模型不继承 Poly Haven 清单的 CC0 声明。
- `textures/pictures/pic1.jpg`：仓库已有装饰画，未提供可靠的上游、作者及许可记录，状态为 `unverified`。

## 程序与第三方库

书房几何、程序纹理和交互由项目代码构建。Babylon.js 的许可证和声明随发布目录保留：[Apache-2.0](licenses/babylonjs-Apache-2.0.md)、[NOTICE](licenses/babylonjs-NOTICE.md)。Webpack 从分包提取的第三方声明保留在对应的 `js/*.LICENSE.txt` 中，全部纳入发布清单。
