# 四房吸顶灯验收

状态：已完成。日期：2026-10-20。输入提交：`08fb5ae`；[技术方案](../../2026-10-20-house-ceiling-lights.md)。本任务针对海岸住宅，唐宅仍为独立的未实施设计。

## 实现与来源

四盏原创程序几何灯具使用既有Cylinder/Torus builder、共享黄铜材质和各自独立的乳白发光罩，无外部素材或新增许可范围。全部位置由房间米制数据计算，根节点/交互/光源/发光材质共用稳定ID。

| 空间 | 稳定ID | 直径 | 强度 | 用途 |
| --- | --- | ---: | ---: | --- |
| 客厅 | `living-ceiling-lamp` | 0.90m | 4.0 | 会客与客厅通行主照明 |
| 主卧 | `master-ceiling-lamp` | 0.70m | 3.2 | 寝卧/衣柜活动区主照明 |
| 次卧 | `bedroom-ceiling-lamp` | 0.65m | 3.0 | 寝卧与房内活动区主照明 |
| 书房 | `study-ceiling-lamp` | 0.55m | 2.7 | 书桌/书架及通行主照明 |

安装面2.8m、发射高度2.65m，166°向下广角聚光，暖白颜色`(1,.94,.82)`；每灯1024²缓存PCF阴影。第一人称近距离抬头左键开关，默认开启，昼夜不代替用户切灯。剖面视角随顶板隐藏实体以免挡住布置，保留主照明；第一人称和海岸封闭视角实体可见。

场景由670→678网格、570,475→575,647顶点、95→99材质、148→152纹理、17→21灯；相机3不变。新增纹理为4个阴影目标，无新增下载贴图。额外灯/阴影/灯槽有渲染与显存成本，本轮未测FPS、耗时或实机性能，不作性能收益结论。

## 检查与画面

[190项测试](tests.log)、[类型检查](typecheck.log)、[临时目录开发构建](development-build.log)、[生产构建及自动发布校验](production-build.log)通过。新测试覆盖顶面/净空、灯罩下发射且中心可见发光罩、近距离射线交互、隔房屏蔽、共享墙/晚到家具灯槽、时段切换保持、局部阴影刷新及房间释放。旧场景不调用四灯接入，保留原灯槽路径。

[专项浏览器结果](browser.json)使用Chrome155.0.8059.82、1280×800、DPR1、禁缓存的独立生产目录。四房分别检查00/03/12/21点、真实指针锁定后左键切灯、关灯跨时段保持、重新开灯、顶板/灯具显隐与最终释放。四房地板实际编译`LIGHT`数量分别为客厅5、其余3房各4，与影响列表一致，新增主灯未被截掉；共享墙和导入家具也保存实际来源/灯槽记录。夜间曝光仍为原方案值，室外时间模型保持。

下面是同一固定房内视角、同一00点、原有台灯始终开启的中心960×440渲染像素亮度均值，量纲为0～255显示像素，**不是现实照度或加载/帧率指标**。开→关→开恢复的均值差为0。

| 房间 | 主灯关闭 | 主灯开启 | 午夜开/关 | 灯具近景 | 21点 | 正午预设 |
| --- | ---: | ---: | --- | --- | --- | --- |
| 客厅 | 20.44 | 49.12 | [开](living-midnight-on.jpg) / [关](living-midnight-off.jpg) | [灯具](living-fixture.jpg) | [夜景](living-evening-on.jpg) | [日景](living-noon.jpg) |
| 主卧 | 29.10 | 72.30 | [开](master-midnight-on.jpg) / [关](master-midnight-off.jpg) | [灯具](master-fixture.jpg) | [夜景](master-evening-on.jpg) | [日景](master-noon.jpg) |
| 次卧 | 32.88 | 94.61 | [开](bedroom-midnight-on.jpg) / [关](bedroom-midnight-off.jpg) | [灯具](bedroom-fixture.jpg) | [夜景](bedroom-evening-on.jpg) | [日景](bedroom-noon.jpg) |
| 书房 | 20.57 | 64.94 | [开](study-midnight-on.jpg) / [关](study-midnight-off.jpg) | [灯具](study-fixture.jpg) | [夜景](study-evening-on.jpg) | [日景](study-noon.jpg) |

[原房屋回归](regression.json)与[执行日志](regression.log)通过8抽屉、原8灯、7门、推拉门、八房55段碰撞通行、地图/信件/拖动缩放/设置/Inspector、双卫镜面、异步失败隔离和释放。套件沿用原验收脚本，仅将有效交互数量28更新为新增四灯后的32；完整旧截图留在`/private/tmp/babylon-ceiling-regression`，本目录额外保存4张本轮正午预设。专项及回归浏览器运行/着色器错误、告警、404均为空。Webpack仍有3条既有性能建议。本轮仅验Chrome，其他引擎/物理设备未验。

## 视觉校准与夹具修正

- 初版实心圆柱边框的底盖挡住发光罩，改为空心圆环，并补充“向上中心射线必须先命中发光罩材质”的断言。发射点始终在灯下。
- 新广角阴影照亮墙面后出现自阴影条纹。比较`bias=.00012/.0005/.001/.003/.005`、`normalBias=.03`；最终采用`.001/.03`，原台灯/窗光参数不改。[低偏移候选](shadow-before.jpg)、[采用候选](shadow-candidate.jpg)和[候选脚本](check-shadow-candidate.cjs)保留，最终四房截图来自重建后的未修改生产包。
- 首次交互夹具误将灯具开关当作E键；代码核查确认现有灯具用左键、E用于车/梯，夹具改为实际左键，没有扩展键盘行为。最终四灯均由真实鼠标事件验证。

## 独立发布与预算

[发布结果](release.json)对根路径及`/home/`各495文件GET、字节及SHA256通过，包含全部动态分包、说明、分析报告与清单自身；[生产清单](release-manifest.json)、[初始模块分析](bundle-analysis.json)及[实现摘要](implementation.json)归档。全部36个运行素材及两目标GLB与输入版本逐字节一致。

| 指标 | 实测 | 相对输入版本 | 原预算 |
| --- | ---: | ---: | ---: |
| 两目标GLB | 4,332,840 B | 0 | ≤4.25MiB |
| 运行素材/文件 | 15,867,377 B / 36 | 0 | ≤16MiB |
| 静态初始JS | 2,686,782 B | +2,105 B | ≤3MiB |
| 实际首屏含必需异步JS | 2,905,634 B / 12 | +2,105 B | ≤3MiB |
| 完整发布目录 | 42,318,496 B / 495 | +2,196 B | ≤41MiB |

## 复跑

先运行`npm test`、`npm run typecheck`、开发构建到临时目录，再执行`npm run build:production`。用[既有独立服务器](../coastal-cliff-d-2026-10-18/serve-dist.py)仅托管最终`dist`（例如`--port 8210`）。运行本目录`check-browser.cjs`、`check-regression.cjs`、`check-release.cjs`，可用`STUDY_URL`指定服务；浏览器包位置用`PLAYWRIGHT_PACKAGE`指定，本机验证使用`/private/tmp/dsh-playwright/node_modules/playwright-core`。

`check-browser`可用`STUDY_CHECK_OUTPUT`指定输出，`check-regression`默认写临时目录；历史证据不覆盖。提交入口：`git log --follow -- docs/technical-plans/2026-10-20-house-ceiling-lights.md`。源码、配置/依赖和相关夹具摘要见实现记录。
