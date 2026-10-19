# 昼夜流转第一阶段验收（2026-10-19）

实施基线 `af11fae`；范围见[昼夜方案](../../2026-10-19-day-night-cycle.md)第 7.1/10 节。第一阶段完成时间配置、方向/轨迹/颜色求值、不可变手动状态与 `RoomScene` 接口，维持原白昼画面；本目录不是八时段视觉交付。后续完整光照、菜单与自动流转仍待实施。

## 实现与接口

- [RoomTimeOfDay](../../../../src/examples/RoomTimeOfDay.ts)：八节点单一配置，标准 sRGB→线性颜色；世界 +X 东、+Y 上、+Z 南，光源方向与灯光传播方向相反；日月轨迹跨午夜顺时针，地下天体直接光关闭，0°～5°平滑渐入。
- `RoomScene.timeOfDay`返回冻结快照，`setTimeOfDay(hour)`立即选择三小时节点（12 默认；24→0）；非法输入保持原状态。元数据 `timeOfDay.stage = 1`、`visualApplied = false`明确逻辑状态尚未应用到画面，不因选择 0 点先单独改暗某盏灯。
- 无新增引擎导入、观察者、定时器、下载素材或持久渲染资源。场景销毁后选点无效；其他实例、旧快照、地图/设置/相机操作不改变所选时间。

## 检查与证据

- [tests.log](tests.log)：172 项全部通过，其中新增 6 项覆盖八节点、深层不可变、方向/影长、夜间月光和地平线门控、全日逐分钟无双主光、线性插值、午夜/负小时回卷、非法输入与实例隔离。`npm run typecheck`通过。
- [开发构建](development-build.log)、[生产构建](production-build.log)通过。开发输出在临时目录，生产发布未被开发构建覆盖；生产有 3 条既有 Webpack 体积/入口/运行时代码建议，未隐藏或关闭检查。
- [baseline.json](baseline.json)：开发前独立生产页面，Chrome 155.0.8059.82，1280×800/DPR1，关闭缓存。保存[阳台](before-balcony.png)、[阅读区](before-reading.png)、[海岸](before-coast.png)；海面时钟固定为 0，仅用于同姿态画面夹具，不测 FPS 或加载耗时。
- [stage1.json](stage1.json)与[check-stage1.cjs](check-stage1.cjs)：根路径真实生产实例中验证 12/06/00 及其余八节点、元数据/快照一致、7点非法输入、视角/地图回家/设置保持、重复销毁保护；未改写生产 bundle 或增加调试全局。通过既有 CDP 夹具捕获实例后调用公开接口，UI 使用真实点击/按键。
- [子路径结果](subpath/stage1.json)：相同接口验收在 `/home/`通过，首屏 12 个 JS 均位于子路径。由于本阶段没有菜单，时间选点由公开 API 夹具执行，不宣称已验证时间菜单交互。
- [原住宅回归](regression/regression.json)：复用[灯塔收尾回归脚本](../lighthouse-finish-2026-10-19/check-regression.cjs)执行 8 抽屉、8 灯、7 门、55 段室内路线、信件/地图/指针锁定/拖动缩放/设置/Inspector、异步书架失败隔离和释放。结果中的 `baseline`是复用套件的历史来源，本次实际生产输入为 `af11fae`加本阶段代码；原灯塔收尾验收目录未改写。
- [release-check.json](release-check.json)与[check-release.cjs](check-release.cjs)：本地发布校验、根路径及 `/home/`各 495 文件全部 GET/字节/SHA256通过，包含未触发的调试/编辑器分包、来源说明与清单自身；36下载素材的字节/摘要对比原灯塔收尾清单完全相同。[完整发布清单](release-manifest.json)留档。

正常根/子路径及原住宅回归页面均无错误、警告或404；回归的家具故障页面有主动中止书架请求，作为单独负向检查记录，不混入正常页面统计。

## 画面与资源

完成后的[阳台](after-balcony.png)、[阅读区](after-reading.png)、[海岸](after-coast.png)已人工查看。三视角灯光、相机与资源计数逐项相同；[像素差](image-comparison.json)记录海岸完全相同、阳台/阅读区的通道平均绝对差分别最多约 0.042/0.209（0～255），不宣称所有截图逐像素一致。

| 指标 | 开发前 | 第一阶段 | 变化 |
| --- | ---: | ---: | ---: |
| 静态初始 JS | 2,659,755 B | 2,663,207 B | +3,452 B |
| 实际首屏 JS（含必需异步） | 2,878,607 B / 12 JS | 2,882,059 B / 12 JS | +3,452 B |
| 两目标 GLB | 4,332,840 B | 4,332,840 B | 0 |
| 下载运行素材 | 15,867,631 B / 36文件 | 15,867,631 B / 36文件 | 0 |
| 完整发布 | 42,283,079 B / 495文件 | 42,286,617 B / 495文件 | +3,538 B |

场景仍为 670 网格、570,475 顶点、95 材质、148 纹理、17 灯、3 相机。原 GLB≤4.25 MiB、运行素材≤16 MiB、静态/实际首屏 JS≤3 MiB、完整发布≤41 MiB预算保持；源码数学模块经生产压缩带来少量 JS 增量，没有新增引擎运行能力或资源分包。

## 复跑

先执行 `npm test`、`npm run typecheck`、临时目录开发构建及 `npm run build:production`。使用已有 `../coastal-cliff-d-2026-10-18/serve-dist.py --port 8192 --root <仓库绝对路径>/dist`仅托管最终目录。

- `PLAYWRIGHT_PACKAGE=/private/tmp/dsh-playwright/node_modules/playwright-core node <本目录>/check-stage1.cjs`验证当前生产；加 `STUDY_URL=http://127.0.0.1:8192/home/`与独立 `STUDY_CHECK_OUTPUT`可复验子路径。`--baseline`只用于开发前基线采集，不应对后续构建重写本次历史基线。
- 原住宅脚本用 `STUDY_URL=http://127.0.0.1:8192/`、`STUDY_CHECK_OUTPUT=<本目录>/regression`与同一 Playwright 路径执行；保留原历史套件，不将当前记录写到旧验收目录。
- `node <本目录>/check-release.cjs`顺序检查根/子路径全部发布文件及运行资源不变；浏览器和摘要抓取按顺序执行，避免复现此前 HTTP 服务器并发重置。

本阶段仅 Chrome 桌面工程验收；没有重跑 WebKit/Firefox/Safari/物理设备、灯塔连续登塔或双镜面像素专测。完整昼夜画面、低角度长影、夜间可见度、菜单/自动时钟及最终平台矩阵待后续。此前暂停的 FPS/GPU/加载耗时实验继续暂停，字节与截图不作为性能收益。
