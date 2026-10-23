# 岛屿树冠素材替换验收

日期：2026-10-23。输入基线`4d9487e`，提交目的“用真实松针素材替换岛屿块状树冠”，标识可由本目录Git历史定位。[完整方案](../../2026-10-23-island-tree-assets.md)。

## 实际效果与来源

使用[Poly Haven Pine Tree 01](https://polyhaven.com/a/pine_tree_01)的CC0松针颜色/遮罩原件，摄影Rob Tuytel、建模Rico Cilliers；不导入大型整树模型。裁切真实针叶并排列13枝松针，生成512px图集。颜色为sRGB，透明遮罩采用alpha test 0.35，双面共用朝上法线近似林冠散射，没有半透明混合、风动画或动态阴影。原件固定URL/MD5/SHA256、许可与工具版本见[来源清单](../../../../public/textures/coastal/pine-source.json)，[加工脚本](../../../../tools/prepare-island-foliage.py)从校验原件可重建，[重建检查](atlas-check.log)通过。

88棵原树（近40、远48）采用16/12张交错枝叶片；根位/高度参数、丘体及全部非树细节与基线逐项一致。树干仍为简化几何，侧视卡片与远处细针仍有近似，不等同于完整写实树林。

- 屋后：[替换前](before/entry-1280.jpg) / [替换后](after/entry-1280.jpg)，[竖屏](after/entry-390.jpg)。
- 塔后：[前](before/tower-grove-1280.jpg) / [后](after/tower-grove-1280.jpg)。
- [灯塔外廊](after/gallery-1280.jpg)、[全景](after/overview-1280.jpg)。
- [正午](after/weather-noon.jpg)、[日落](after/weather-sunset.jpg)、[午夜](after/weather-night.jpg)、[雾](after/weather-fog.jpg)、[雨](after/weather-rain.jpg)。

## 检查与成本

[418测试](tests.log)、[类型](typecheck.log)、[开发构建](development-build.log)、[生产构建/发布校验](production-build.log)通过。最后清理旧树枝测试分支并补查新材质的剖面隔离后，[7项景观回归](landscape-tests.log)再次通过。原36件素材及全部动态分包保持；仅新增松针图集及来源说明到发布白名单。

[浏览器脚本](check-browser.cjs)在独立最终生产目录检查九机位×1280×800/390×844/844×390，共27组[前](before/browser.json)/[后](after/browser.json)相机姿态一致。昼夜/天气、拖动缩放、地图、设置/重置、Inspector及子路径启动通过；正常路径无运行/着色器错误或404，Inspector有原CSS弃用提示，Webpack有原三条体积建议。另阻断松针请求，确认9个树批次隐藏而地面与就绪状态正常，无页面异常。

[移动检查](check-movement.cjs)/[结果](movement.json)使用原生键盘事件及60Hz参考步进，验证1.3速度比、默认/最高倍率护栏阻挡和设置重置；这不是FPS或完整旅程耗时测量。

| 指标 | 基线 | 最终 |
| --- | ---: | ---: |
| 两目标GLB | 4,332,840 B | 4,332,840 B |
| 运行素材 | 15,867,377 B | 15,931,426 B |
| 静态初始JS | 2,921,568 B | 2,921,345 B |
| 实际首屏JS（12请求含必要异步） | 3,140,058 B | 3,139,835 B |
| 完整发布目录 | 42,654,230 B | 42,721,776 B |

首屏余5,893 B、发布余269,840 B，四项硬预算保持。根与`/home/`各498文件逐一GET/字节/SHA256通过，[前清单](before/release-manifest.json)/[后清单](after/release-manifest.json)包含全部分包、来源及许可说明。

景观仍19网格，顶点9,921→10,129、三角形14,944→9,216；原海岸+全部景观165,805≤166,000。完整外廓离可走区最少8.050m，16条地标视线无遮挡；树根及丘缘真实地面支撑、低物闭合与贴地、材质释放通过。跨阶段替换后，旧160,000的分期前缀范围改为直接检查既有166,000总量，无景观漏计；历史非树几何摘要保持。

全场景网格735、灯22、相机3、带阴影灯19不变；材质109→110、纹理153→154、顶点585,319→585,527。[结构/字节记录](geometry-and-release.json)由[复核脚本](check-evidence.cjs)生成，包含源码摘要、几何、完整发布和原素材保护结果。

性能采样继续暂停，不宣称FPS无损或加载提速。其他浏览器引擎、物理设备以及完整原生步行/骑行往返本轮未验。重跑上述三个cjs脚本；基线用`LANDSCAPE_BASELINE=1 LANDSCAPE_DIST=<4d9487e生产目录>`。依赖本机Chrome及已有Playwright工具运行时，不新增项目依赖。
