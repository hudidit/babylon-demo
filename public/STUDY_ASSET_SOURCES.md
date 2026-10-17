# 书房发布资源来源

本目录只包含当前书房运行素材、生产页面与全部动态调试分包。文件摘要和字节数见 [发布清单](release-manifest.json)。各类素材的许可状态独立记录。

## Poly Haven 素材

地板 `wood_floor`、木材 `wood_table_001`、亚麻 `rough_linen`、沙发 `sofa_03`、扶手椅 `modern_arm_chair_01` 和环境 `brown_photostudio_01` 的来源、作者、下载 URL、原件摘要及处理方式见 [来源清单](textures/study/manifest.json)。这些素材按来源记录使用 [CC0-1.0](https://polyhaven.com/license)。清单中 `public/` 前缀对应开发仓库，发布路径去掉该前缀；模型的 `sourceFiles` 为上游文件记录，不是额外运行依赖。该历史清单中的 `brick_wall_001` 已被漆面替换，不再作为运行素材发布。

历史森林远景与树皮来自 Andreas Mischok 的 [Forest Slope](https://polyhaven.com/a/forest_slope)，按来源记录为 CC0-1.0。当前场景已切换为海岸空间灰盒，森林图片及其处理记录退出当前发布白名单；历史原件、来源记录和八房v1稳定基线仍保留在开发仓库，不能把历史森林清单当作当前海岸素材。

## 仓库已有素材

- `models/gothic_commode.glb`、`models/wooden_bookshelf.glb`：仓库引入提交分别为 `9a2d8c1`、`0e83f4c`，未记录上游、作者及许可，状态为 `unverified`。本轮只压缩内嵌 JPEG，保留几何、UV、节点与材质；详见 [独立处理记录](models/study-model-optimization.json)。两件模型不继承 Poly Haven 清单的 CC0 声明。
- `textures/pictures/pic1.jpg`：仓库已有装饰画，未提供可靠的上游、作者及许可记录，状态为 `unverified`。

## 程序与第三方库

交互音效来自 laleksic 的 [Various Sound Effects](https://opengameart.org/content/various-sound-effects)，按作者声明使用 CC0-1.0。选用八个无损实物录音原件，裁成十二个短单声道 PCM WAV；来源、原件/交付摘要、剪辑区间与处理参数见[音频来源记录](audio/study/source.json)，面向用户的[音效来源页](audio/study/credits.html)随发布交付。录音不是 AI 或程序合成；原件保留在开发仓库 `assets/audio-source/study/`，不进入运行白名单。

`textures/study/painted_wall` 为本项目原创的暖米白乳胶漆微表面纹理，不是外部扫描素材，不继承 Poly Haven 的 CC0 声明；按项目源代码条款使用。生成脚本、固定种子、颜色/法线/ARM语义及最终文件摘要见[漆面来源记录](textures/study/painted_wall/source.json)。三张512² PNG采用无缝周期细噪声，保留轻微滚涂颗粒，不包含砖缝或裂纹。

书房、客厅和全屋结构的程序几何、程序纹理与交互由项目代码构建。主卧与次卧床/柜、次卧阅读凳/台灯、双卫洁具/淋浴/瓷砖勾缝、厨房橱柜/水槽/灶台/冰箱和阳台推拉门/长凳/边桌为本项目原创程序组件，按项目源代码条款使用，复用既有木纹、织物、透明门窗和室内HDR；未增加下载模型或图片。浴室镜面使用512²实时平面反射目标，绘制所在卫浴的实际几何，不使用HDR中的其他房间作倒影。Babylon.js 的许可证和声明随发布目录保留：[Apache-2.0](licenses/babylonjs-Apache-2.0.md)、[NOTICE](licenses/babylonjs-NOTICE.md)。Webpack 从分包提取的第三方声明保留在对应的 `js/*.LICENSE.txt` 中，全部纳入发布清单。

海岸阶段A的连续崖顶地形、分层崖壁/岩岬、房屋基座、静态海平面和顶点色天空为本项目原创程序几何，按项目源代码条款（ISC）使用；无新增下载图片、模型或室外HDR。米制尺寸、生成方式、来源代码和当前限制见[海岸灰盒来源记录](environment/coastal-cliff-source.json)。当前仅验证空间，岩石精细PBR、室外日光和动态海浪尚未实施。
