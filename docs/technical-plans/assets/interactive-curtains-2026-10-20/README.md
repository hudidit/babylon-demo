# 窗帘点击开合验收

状态：已完成。日期：2026-10-20。输入提交`603342d`；[技术方案](../../2026-10-20-interactive-curtains.md)。范围为海岸住宅六扇既有窗帘，不涉及唐宅。

## 交付与来源

每窗两幅帘布成组控制，默认扎起打开；点击布面、挂环或扎带关闭，再次点击打开，约0.85秒平滑运动，中途点击连续反向。第一人称遵守原7.5单位操作距离，轨道视角沿用原射线/遮挡和拖动误触保护，没有新增透明点击面或键盘映射。

| 空间 | 稳定交互ID | 打开 | 合拢中 | 关闭 |
| --- | --- | --- | --- | --- |
| 主卧 | `master-window-curtains` | [图](master-window-curtains-open.jpg) | [图](master-window-curtains-moving.jpg) | [图](master-window-curtains-closed.jpg) |
| 书房 | `study-window-curtains` | [图](study-window-curtains-open.jpg) | [图](study-window-curtains-moving.jpg) | [图](study-window-curtains-closed.jpg) |
| 厨房 | `kitchen-window-curtains` | [图](kitchen-window-curtains-open.jpg) | [图](kitchen-window-curtains-moving.jpg) | [图](kitchen-window-curtains-closed.jpg) |
| 主卫 | `ensuite-window-curtains` | [图](ensuite-window-curtains-open.jpg) | [图](ensuite-window-curtains-moving.jpg) | [图](ensuite-window-curtains-closed.jpg) |
| 次卧 | `bedroom-window-curtains` | [图](bedroom-window-curtains-open.jpg) | [图](bedroom-window-curtains-moving.jpg) | [图](bedroom-window-curtains-closed.jpg) |
| 客厅 | `living-window-curtains` | [图](living-window-curtains-open.jpg) | [图](living-window-curtains-moving.jpg) | [图](living-window-curtains-closed.jpg) |

复用原程序亚麻帘、原挂环/扎带几何和既有材质，未新增下载素材、纹理或依赖。打开端点保留原顶点，关闭形态由相同网格拓扑生成；挂环仅沿杆平移，不拉长金属圈，扎带淡出。帘布先前移避让窗台再展开，中央轻微重叠。每窗3个动态批次，静态杆/窗框继续合批；旧示例保留静态窗饰路径。原素材来源/许可状态不变，不因本次程序几何改动扩大许可声明。

变形同步更新包围盒、实际拾取、对应房间阴影及窗光代理，静止不重复刷新。帘布不新增碰撞障碍，窗洞/墙体/室外防越界保持；剖面随对应窗框显隐，镜面使用同一实际几何。关帘使对应直接窗光代理最多衰减至4%，日夜变化保持关闭比例；人工灯、全局补光和室内IBL保持原规则。主卫没有直射窗光代理，主要体现实际遮窗。此为美术照明近似，不是布料物理或完整透射模拟，无新增音效。

## 工程与浏览器

[193项测试](tests.log)、[类型检查](typecheck.log)、[临时目录开发构建](development-build.log)、[生产构建/发布校验](production-build.log)通过。新增3项测试检查六窗实际开口/中央/上下边界、原打开顶点及挂环精确恢复、展开期间窗台净空、金属圈刚性平移、归属/旋转/缩放、真实射线及遮挡/距离、连续反向、独立采光/人工灯、静止缓存和房间清理。

[专项结果](browser.json)使用Chrome155.0.8059.82、1280×800、DPR1、禁缓存、独立生产目录。六窗逐一真实左键关/开、动画中反向、顶点原样恢复，日间12点（客厅9点）和午夜0点保持状态；保存18张开/合中/关闭图以及[午夜闭帘](living-window-curtains-midnight-closed.jpg)、[第一人称闭帘](first-person-closed.jpg)。截图临时冻结delta，避免截图步骤推进动画，不是性能采样。

地图在合拢途中打开，20个生产渲染回调中进度保持；关闭后从原进度继续。真实指针锁定后第一人称左键可关帘，两种视角往返开合不重置。原12盏住宅灯的开关/强度保持，动态帘布均无碰撞；两张镜面目标保留并包含对应实际窗帘。循环前后资源数一致，销毁后网格/材质/纹理/灯均为0。

[原房屋回归](regression.json)通过8抽屉、原8灯真实点击、7门/推拉门、55段全屋通行、地图/信件/拖动缩放/设置/Inspector、双卫镜面与异步失败隔离/释放。复用[原套件](../lighthouse-finish-2026-10-19/check-regression.cjs)，仅把有效交互数量改为含四吸顶灯/六窗帘的38；完整原功能截图在临时目录`/private/tmp/babylon-curtains-regression`。本轮专项及正常浏览器回归的运行/着色器错误、告警、404均为空；预期故障注入按原套件单列。Webpack保留3条既有性能建议。

## 净空修正与验证边界

首次闭帘出现重复暗斑。临时关闭阴影接收、调整阴影偏移、去掉AO/法线贴图均未消除；只显示帘布时暗斑消失，定位为原窗压条/前伸窗台穿过展开后的褶皱。[修正前](clearance-before.jpg)与[最终闭帘](master-window-curtains-closed.jpg)保留。最终仅调整释放/展开轨迹，展开段布面在窗台局部`Z=-.8`之前，保留打开端点；原灯光、AO、阴影/材质均未为掩盖问题而关闭。

近景脚本首次沿用海岸视角`minZ=5`，把距相机3.65单位的布面裁掉，导致截图看到室外、屏幕拾取失败。最终夹具采用室内近裁面`.1`，应用相机配置未改；截图用完整窗户姿态、实际点击另用可达近景。此前失败不计验收通过。

本轮验Chrome桌面，其他浏览器/实机未验。动态顶点、法线和阴影刷新有运行成本，未做FPS、加载耗时或额外性能试验。

## 发布和预算

[独立发布结果](release.json)、[完整清单](release-manifest.json)、[模块分析](bundle-analysis.json)及[源码/夹具摘要](implementation.json)保存。根路径和`/home/`各495文件GET、字节及SHA256通过，包括全部动态分包、说明、报告和清单自身；36运行素材与两目标GLB与输入版本摘要一致。

| 指标 | 实测 | 较输入版本 | 原预算 |
| --- | ---: | ---: | ---: |
| 两目标GLB | 4,332,840 B | 0 | ≤4.25MiB |
| 运行素材 | 15,867,377 B / 36文件 | 0 | ≤16MiB |
| 静态初始JS | 2,690,218 B | +3,436 B | ≤3MiB |
| 实际首屏含必需异步JS | 2,909,070 B / 12文件 | +3,436 B | ≤3MiB |
| 完整发布 | 42,322,017 B / 495文件 | +3,521 B | ≤41MiB |

网格678→684（+6）；顶点575,647、材质99、纹理152、灯21、相机3均不变。几何复用不代表动态CPU/GPU或内存成本不变；没有据此推断性能收益。

## 复跑与提交

执行`npm test`、`npm run typecheck`、开发构建到临时目录，再执行`npm run build:production`。用[既有服务器](../coastal-cliff-d-2026-10-18/serve-dist.py)仅托管最终`dist`，例如`--port 8211`；运行本目录`check-browser.cjs`、`check-regression.cjs`、`check-release.cjs`，可用`STUDY_URL`改地址、`PLAYWRIGHT_PACKAGE`指定Playwright（本机`/private/tmp/dsh-playwright/node_modules/playwright-core`）。专项支持`STUDY_CHECK_OUTPUT`，回归默认写临时目录。提交入口：`git log --follow -- docs/technical-plans/2026-10-20-interactive-curtains.md`。
