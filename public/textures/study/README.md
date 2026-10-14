# 书房材质与家具资源

这些外部资源用于房间真实感优化，来自 [Poly Haven](https://polyhaven.com)，按 [CC0 素材许可](https://polyhaven.com/license) 使用和分发。

完整作者、下载 URL、源文件 MD5、模型打包后 SHA256 及文件大小见 [manifest.json](manifest.json)。

| 资源 | 场景用途 | 本地文件 |
| --- | --- | --- |
| [Wood Floor](https://polyhaven.com/a/wood_floor) | 木地板 | `wood_floor/color.jpg`、`normal.jpg`、`arm.jpg` |
| [Wood Table 001](https://polyhaven.com/a/wood_table_001) | 家具木材与木饰面 | `wood_table_001/color.jpg`、`normal.jpg`、`arm.jpg` |
| [Brick Wall 001](https://polyhaven.com/a/brick_wall_001) | 墙砖 | `brick_wall_001/color.jpg`、`normal.jpg`、`arm.jpg` |
| [Rough Linen](https://polyhaven.com/a/rough_linen) | 织物微表面 | `rough_linen/normal.jpg`、`arm.jpg` |
| [Sofa 03](https://polyhaven.com/a/sofa_03) | 阅读区沙发 | [sofa_03.glb](../../models/study/sofa_03.glb) |
| [Modern Arm Chair 01](https://polyhaven.com/a/modern_arm_chair_01) | 窗边扶手椅 | [modern_arm_chair_01.glb](../../models/study/modern_arm_chair_01.glb) |
| [Brown Photostudio 01](https://polyhaven.com/a/brown_photostudio_01) | 室内环境照明与反射 | [study-interior.hdr](../../environment/study-interior.hdr) |
| [Forest Slope](https://polyhaven.com/a/forest_slope) · Andreas Mischok | 第 6 项优化的实景窗外背景 | [forest-window/view.jpg](forest-window/view.jpg)、[来源与处理参数](forest-window/source.json) |

## 材质约定

- 贴图使用官方 1K JPEG。颜色贴图按 sRGB 读取，法线与 ARM 按线性数据读取。
- 法线选用 OpenGL 版本，由材质根据场景坐标系处理方向。
- ARM 的 R、G、B 分别存储遮蔽、粗糙度、金属度。墙面各贴图的重复比例保持一致。
- 亚麻只使用扫描法线与 ARM，颜色由材质指定，保留原有复古配色；布料的 sheen 表现柔和的边缘反光。
- HDRI 使用官方 1K HDR，加载时生成 128 像素立方体的预过滤环境反射。
- 窗景从 Forest Slope 官方 8K 色调映射全景重投影为 1600 × 1165 的透视 JPEG，未把整张球面全景直接拉伸到窗户。源图 MD5、交付文件 SHA256、视场角和朝向见 `forest-window/source.json`。它只提供可见背景，不改变室内 HDR 照明；窗外没有真实视差。
- 叶脉与书页边缘为程序生成的共享纹理，叶片和窗帘为静态薄面几何，不增加外部模型下载。

## 模型处理

模型使用官方 1K glTF 版本，将原二进制缓冲和 JPEG 原样嵌入 GLB，以减少运行时资源请求。几何和图像内容未修改，文件名及源文件摘要保留在清单中。扶手椅的皮革在运行时调整为苔绿色，继续使用原扫描法线与粗糙度。

模型位置根据实际包围盒归一化，保留 glTF 的坐标转换与节点层级，再设置尺寸、朝向和落地高度。来源清单中的模型 `sourceFiles.file` 是官方 glTF 包内的相对路径，模型最终交付路径见对应的 `file` 字段。
