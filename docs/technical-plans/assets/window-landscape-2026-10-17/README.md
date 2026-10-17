# 窗外景观空间化验收

2026-10-17，基线 `aafd302`，对应[技术方案](../../2026-10-17-window-landscape-depth.md)。截图来自独立托管的最终生产目录，固定相机/渲染delta仅用于功能和画面检查，不是FPS或加载耗时样本。

## 实现与画面

- 原窗片及整块木背板替换为四边框架、真实通透窗洞和弱冷色透明玻璃；六窗保持原尺寸、窗帘/窗台和防越界碰撞。窗景不再依附窗面UV，各朝向共享同一世界坐标的森林。
- [RoomExterior](../../../../src/examples/RoomExterior.ts)建立16棵高树、8棵幼树，树干有收尖/轻弯、立体分枝，叶片为不透明弯曲几何；按四个方向分别合并树干与叶片，加环境面共9个静态网格。光照烘入顶点，窗外不参与室内灯的投影或交互拾取，不增加灯、相机、阴影图或反射目标。
- 4096×2048摄影用于天空/远处森林；树干远景带竖直延续到地面，V≥0.67区域投射到实际地形，保持UV连续，避免重复地面贴图的直线接缝及压平照片树根产生的明显弯折。全屋鸟瞰隐藏室外环境，室内预设及第一人称显示；现有主卫镜面可以通过透明窗反射森林。
- 近景树皮裁自同一Forest Slope原件，作者及CC0条款沿用来源；完整全景与树皮合计1,910,839字节，替代1,155,565字节的旧透视裁片。旧图片从运行目录移除，可由Git历史恢复。[转换脚本](../../../../tools/prepare-forest-panorama.py)校验固定原件MD5/SHA256，记录Pillow版本、裁切坐标和编码参数；重复执行交付摘要逐字节一致，见[素材记录](../../../../public/textures/study/forest-window/source.json)。

| 视角 | 修改前 | 修改后 |
| --- | --- | --- |
| 书房正视 | [原窗片](before-study-front.jpg) | [共享森林](study-front.jpg) |
| 书房斜视 | [原窗片](before-study-oblique.jpg) | [透过窗洞](study-oblique.jpg) |
| 窗前左侧 | [原窗片](before-study-left.jpg) | [近树遮挡](study-left.jpg) |
| 窗前右侧 | [原窗片](before-study-right.jpg) | [视差变化](study-right.jpg) |
| 阳台 | [原灰色背景](before-balcony.jpg) | [连续室外环境](balcony.jpg) |

补充：[主卧窗](master-front.jpg)、[次卧西窗](bedroom-front.jpg)、[客厅东窗](living-front.jpg)、[书房竖屏](study-portrait.jpg)、[书房预设](study-preset.jpg)、[全屋鸟瞰](overview.jpg)。

## 验证

- [93项测试](tests.log)、[类型检查](typecheck.log)、[开发构建](development-build.log)、[生产构建及发布校验](production-build.log)通过。新增测试用实际射线检查六扇窗无背板遮挡，真实碰撞仍阻止穿窗；检查共享环境/下载、近远距离、地面投影、树干正面朝向、几何成本/归属/释放。独立pure进程实际构建并渲染室外，避免总入口预注册掩盖依赖遗漏。
- [窗景专项脚本](check-window.cjs)与[结果](window.json)：1280×800、DPR1、禁用缓存，书房正视/左右横移/斜视、主卧/次卧/客厅及阳台实际画面通过，390×844竖屏可用。相机保持朝向横移1m，以实际树干位置和远处环境面为锚点验证近景相对远景的屏幕位移，详见结果中的`parallax`。它证明空间视差，不是帧率或加载实验。
- [全屋回归结果](browser.json)复用[阶段E脚本](../house-bedroom-2026-10-17/check-regression.cjs)，覆盖八抽屉、六灯、七门实际点击、关闭阻挡/打开双向通行、第一人称连续动线、地图/信件/指针锁定恢复、横竖屏、设置/拖动缩放/Inspector、书架加载失败和重复pagehide释放。
- [镜面专项结果](mirror-map.json)复用[阶段E镜面脚本](../house-bedroom-2026-10-17/check-map-mirror.cjs)，检查真实几何隐藏/恢复、门灯/视角变化的反射像素及背向/视锥外刷新门控；保留主画面prepass，镜面不添加prepass目标。旧阶段D脚本等待的状态文本已过时，复验使用与当前次卧版本一致的阶段E脚本。
- 最终489个发布文件逐项独立托管GET/SHA256通过，包括全部动态调试分包、许可/来源及清单；[子路径结果](subpath.json)复用[子路径脚本](../house-bedroom-2026-10-17/check-subpath.cjs)，只通过`home -> dist`托管`/home/`。正常流程无运行/着色器错误、404或浏览器告警；保留Webpack原有三类体积/缓存建议告警。失败注入单独记录。

## 资源与成本

[前后记录](resource-changes.json)、[最终清单](release-manifest.json)、[模块分析](bundle-analysis.json)及[基线清单](before-release-manifest.json)保存原始字节。31个运行素材，两个目标GLB保持4,332,840字节（4.13 MiB），依赖及四项预算不变。

| 指标 | 修改前 | 修改后 |
| --- | ---: | ---: |
| 运行素材 | 15,702,135字节 / 14.97 MiB | 16,457,409字节 / 15.70 MiB |
| 静态初始JS | 2,516,484字节 / 2.40 MiB | 2,520,440字节 / 2.40 MiB |
| 实际首屏JS，含必需异步与音频预热 | 2,735,336字节 / 2.61 MiB | 2,739,292字节 / 2.61 MiB |
| 完整发布，含清单自身 | 41,983,092字节 / 40.04 MiB | 42,743,775字节 / 40.76 MiB |
| 网格 / 顶点 | 539 / 367,940 | 548 / 511,483 |
| 材质 / 纹理对象 | 69 / 134 | 72 / 135 |
| 灯 / 相机 | 11 / 3 | 11 / 3 |

增加近景几何、一个额外纹理对象和更大的全景像素，换取窗洞通透、方向一致和真实视差；可见镜面的局部绘制也包含窗外几何。没有新增渲染目标，未测显存/GPU耗时、FPS或加载速度，不能把仅增加0.72 MiB发布字节理解为渲染成本不变。

## 复现及边界

```sh
npm test
npm run typecheck
npm run build -- --output-path /tmp/window-landscape-dev
npm run build:production
python3 -m http.server 8120 --bind 127.0.0.1 --directory dist
```

指定`PLAYWRIGHT_PACKAGE=/path/to/playwright`、`STUDY_URL=http://127.0.0.1:8120/`、`STUDY_CHECK_OUTPUT=/tmp/check-output`运行上述三个浏览器脚本。子路径脚本使用`STUDY_SUBPATH_URL=http://127.0.0.1:8121/home/`。素材复现使用固定摘要的Forest Slope官方原件作为`prepare-forest-panorama.py`唯一参数，不从旧裁片或已压缩全景再次编码。

远景仍为摄影环境近似，地面投影不等于真实扫描地形；近景林木为程序几何，没有模拟风或提供室外漫游。现有室内灯光、HDR、SSAO和交互保持，既有暂停的性能/听感验收状态不变。本次代码、素材、方案/索引/变更日志和证据统一随“改善窗外森林空间层次与移动视差”提交，提交标识见Git历史。
