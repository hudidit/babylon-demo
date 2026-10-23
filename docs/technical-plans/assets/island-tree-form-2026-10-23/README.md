# 海岛树形与密集叶簇验收

日期：2026-10-23；基线`f5172ba`。[实施方案](../../2026-10-23-island-tree-form.md)。提交目的：`重建海岛树形与密集枝叶`，实际标识见本目录Git历史及任务回复。

## 实际画面

88棵树使用曲干、连接主枝和饱满的多簇开展树冠，替代初版稀疏的整齐枝层。三种叶簇由细小针叶组合，树皮与叶簇同图集、同材质；不将松针原件识别为已确认的黑松。温带岩岸为本轮美术工作假设。

- 屋后：[前](before/entry-1280.jpg) / [后](after/entry-1280.jpg)，[窄屏](after/entry-390.jpg)、[横屏](after/entry-844.jpg)。
- 塔后：[前](before/tower-grove-1280.jpg) / [后](after/tower-grove-1280.jpg)。
- [外廊俯视](after/gallery-1280.jpg)、[沿途侧视](after/path-1280.jpg)、[阳台](after/balcony-1280.jpg)、[全景](after/overview-1280.jpg)。
- 屋后近景：[正午](after/weather-entry-noon.jpg)、[日落](after/weather-entry-sunset.jpg)、[午夜](after/weather-entry-night.jpg)、[雾](after/weather-entry-fog.jpg)、[雨](after/weather-entry-rain.jpg)。同样保留五种天气的全景截图。

截图取自实际生产包，无后期美化。近景树冠更饱满，边缘仍可见细枝缺口；可观察到分叉连接，俯视有冠顶。工程断言不等于用户认可美术；叶簇仍为多片交叉近似，树干横截面、草石也保留简化，未宣称照片级还原。

## 来源与复现

使用Poly Haven Pine Tree 01的三张CC0原件：松针颜色/遮罩、树皮颜色；摄影Rob Tuytel、建模Rico Cilliers。未导入完整高模。固定URL、许可、MD5/SHA256、Pillow 12.3.0和最终摘要见[来源JSON](../../../../public/textures/coastal/pine-source.json)。[脚本](../../../../tools/prepare-island-foliage.py)从原件生成三种512px密集叶簇，每种360根小枝，与树皮拼成1024px索引PNG。[确定性重建检查](atlas-check.log)通过。

颜色为sRGB、alpha test 0.35，保留共享PBR与资源失败降级；无半透明混合或新依赖。PNG为265,227 B，较初版增201,178 B。RGBA8完整mipmap存储估算约1.33→5.33 MiB，非显存实测；透明覆盖也有成本，不能据顶点增量推断FPS无损。

## 检查与发布

[419测试](tests.log)、[8项景观回归](landscape-tests.log)、[类型](typecheck.log)、[开发构建](development-build.log)、[最终生产构建/发布校验](production-build.log)通过。测试包含枝干连接、树根实际地面支撑、枝叶法线/UV、完整外廓与地标视线、材质释放及失败处理。

[浏览器脚本](check-browser.cjs)独立托管完整生产目录，九机位×1280×800/390×844/844×390共27组[前](before/browser.json)/[后](after/browser.json)姿态一致，另外保存五天气×全景/屋后共10张截图。地图、拖动缩放、设置/重置、Inspector、子路径启动通过；故意中断图集请求时仅隐藏9个树批次，场景正常就绪，地面保留。正常路径无运行/着色器错误或404；Inspector保留原CSS弃用提示，Webpack保留原三条体积建议。

[移动脚本](check-movement.cjs)及[结果](movement.json)以原生键盘事件和60Hz参考步进验证1.3速度比、默认/最高倍率护栏阻挡与设置重置。这不是FPS或完整旅程耗时测量。

| 指标 | f5172ba | 本轮 |
| --- | ---: | ---: |
| 两目标GLB | 4,332,840 B | 4,332,840 B |
| 运行素材（37件） | 15,931,426 B | 16,132,604 B |
| 静态初始JS | 2,921,345 B | 2,922,227 B |
| 实际首屏JS（12请求含必要异步） | 3,139,835 B | 3,140,717 B |
| 完整发布目录 | 42,721,776 B | 42,926,938 B |

四项原预算保持，首屏余5,011 B、发布余64,678 B。根与`/home/`各498文件逐个GET/字节/SHA256通过；[发布清单](after/release-manifest.json)包含所有动态分包、来源和许可说明。除替换图集外其余36项运行素材摘要不变，动态分包集合保持。

景观仍19网格，顶点10,129→10,153、三角形9,216→10,416；原海岸+景观165,829≤166,000。完整外廓距可走区最小8.050m，16条地标视线不受阻；88棵根位/高度参数、丘体和非树细节摘要一致。全场景735网格、110材质、154纹理、22灯、3相机和19带阴影灯保持，顶点585,527→585,551。[复核脚本](check-evidence.cjs)和[记录](geometry-and-release.json)保存源码摘要、几何及字节变化。

性能采样继续暂停，无实测FPS/加载速度结论；其他浏览器引擎、物理设备和完整原生步行/骑行往返本轮未验。复跑上述三个cjs脚本即可；基线设置`LANDSCAPE_BASELINE=1 LANDSCAPE_DIST=<f5172ba生产目录>`。依赖本机Chrome及已有Playwright运行时，不新增项目依赖。
