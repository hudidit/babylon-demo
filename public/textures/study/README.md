# 书房材质与家具资源

下表列出的外部扫描资源来自 [Poly Haven](https://polyhaven.com)，按 [CC0 素材许可](https://polyhaven.com/license) 使用和分发。新增 `painted_wall` 为本项目原创程序纹理，单独记录来源和条款。

完整作者、下载 URL、源文件 MD5、模型打包后 SHA256 及文件大小见 [manifest.json](manifest.json)。

该清单中的模型仅包括 `sofa_03` 和 `modern_arm_chair_01`。旧古董柜与书架的贴图优化及独立来源记录见 [模型说明](../../models/README.md) 和 [处理清单](../../models/study-model-optimization.json)，其来源与授权状态单独记录。

| 资源 | 场景用途 | 本地文件 |
| --- | --- | --- |
| [Wood Floor](https://polyhaven.com/a/wood_floor) | 木地板 | `wood_floor/color.jpg`、`normal.jpg`、`arm.jpg` |
| [Wood Table 001](https://polyhaven.com/a/wood_table_001) | 家具木材与木饰面 | `wood_table_001/color.jpg`、`normal.jpg`、`arm.jpg` |
| [Brick Wall 001](https://polyhaven.com/a/brick_wall_001) | 历史砖墙，已退出运行与发布 | `brick_wall_001/color.jpg`、`normal.jpg`、`arm.jpg` |
| [Rough Linen](https://polyhaven.com/a/rough_linen) | 织物微表面 | `rough_linen/normal.jpg`、`arm.jpg` |
| [Sofa 03](https://polyhaven.com/a/sofa_03) | 阅读区沙发 | [sofa_03.glb](../../models/study/sofa_03.glb) |
| [Modern Arm Chair 01](https://polyhaven.com/a/modern_arm_chair_01) | 窗边扶手椅 | [modern_arm_chair_01.glb](../../models/study/modern_arm_chair_01.glb) |
| [Brown Photostudio 01](https://polyhaven.com/a/brown_photostudio_01) | 室内环境照明与反射 | [study-interior.hdr](../../environment/study-interior.hdr) |
| [Forest Slope](https://polyhaven.com/a/forest_slope) · Andreas Mischok | 全屋共享森林远景与投影地面 | [panorama.jpg](forest-window/panorama.jpg)、[来源与处理参数](forest-window/source.json) |

## 材质约定

- 两房当前墙面使用原创暖米白乳胶漆纹理：`painted_wall/color.png`、`normal.png`、`arm.png`，512²、周期细颗粒；来源、生成脚本/参数与SHA256见[独立记录](painted_wall/source.json)。它不属于本目录Poly Haven扫描清单，不继承其CC0声明。
- 外部扫描贴图使用官方 1K JPEG。颜色贴图按 sRGB 读取，法线与 ARM 按线性数据读取。
- 法线选用 OpenGL 版本，由材质根据场景坐标系处理方向。
- ARM 的 R、G、B 分别存储遮蔽、粗糙度、金属度。墙面各贴图的重复比例保持一致。
- 亚麻只使用扫描法线与 ARM，颜色由材质指定，保留原有复古配色；布料的 sheen 表现柔和的边缘反光。
- HDRI 使用官方 1K HDR，加载时生成 128 像素立方体的预过滤环境反射。
- 森林远景从 Forest Slope 官方8K色调映射全景缩小为4096×2048 JPEG，保留360°方向；下部地面区域投射到真实地形并与远景连续衔接，树皮也裁自同一实拍原件。源图MD5/SHA256、裁切坐标、交付摘要及可复现脚本见 `forest-window/source.json`。全屋共享远处环境及近中景实际树木，提供移动视差；室内HDR保持原样。旧1600×1165透视窗片在本轮移除，可由Git历史恢复。
- 叶脉与书页边缘为程序生成的共享纹理，叶片和窗帘为静态薄面几何，不增加外部模型下载。

## 模型处理

模型使用官方 1K glTF 版本，将原二进制缓冲和 JPEG 原样嵌入 GLB，以减少运行时资源请求。几何和图像内容未修改，文件名及源文件摘要保留在清单中。扶手椅的皮革在运行时调整为苔绿色，继续使用原扫描法线与粗糙度。

模型位置根据实际包围盒归一化，保留 glTF 的坐标转换与节点层级，再设置尺寸、朝向和落地高度。来源清单中的模型 `sourceFiles.file` 是官方 glTF 包内的相对路径，模型最终交付路径见对应的 `file` 字段。
