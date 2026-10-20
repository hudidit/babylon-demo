# 灯塔子项目一第一阶段验收

日期：2026-10-20。基线`b8d9f12`，其运行代码为`e589509`；范围为[详细方案](../../2026-10-20-lighthouse-project-01-core-loop.md)的“一 逻辑与时间接入”。代码和本目录证据随方案同一提交保存，实施提交由Git历史追踪。灯头视觉、基本面板、巡检和完整项目验收分别属于第二至四阶段。

## 实现与接续接口

- [RoomTimeOfDay](../../../../src/examples/RoomTimeOfDay.ts)保留`advance()`快照返回值，以不可变`lastAdvance`提供本帧起止时刻、接受的活跃秒/自动场景小时、午夜次数和手动过渡完成标记。非法帧与恢复首帧零推进；每帧最多0.1秒。手动淡化不是经过的日历，自动小时的浮点边界对齐避免整数时刻延后一帧。
- [LighthouseOperation](../../../../src/examples/LighthouseOperation.ts)是纯逻辑唯一状态：`day-standby`、`night-running`、`test-running`；日程18:00至次日06:00；试灯30活跃秒且可提前结束，重复开始不延长；转台相位每10活跃秒一圈、停机保留。自动日程/午夜与试灯到期分段结算，事件给出发生时刻和来源；夜间测试不产生额外起灯事件，18点接管测试，6点仍有测试则继续。
- 值守日初始为1，只随统一时钟的自动午夜增加。`automaticOperatingHours`只累计运行中实际接受的自动场景小时，含试灯；固定21点仍旋转，但不虚构流逝的整夜工时。最近7个值守日的事件含单调编号、设备、日序/时刻、类型、来源与结果，裁剪不删除设备或累计状态。刷新重新初始化；没有跨会话保存或任务结算。
- [RoomScene](../../../../src/examples/Room.ts)在既有更新中消费时间，`lighthouseOperation`返回冻结状态，`startLighthouseTest()`/`endLighthouseTest()`供后续局部交互使用。当前没有新增玩家面板；元数据`lighthouseOperation.stage = 1`、`visualApplied = false`明确还未改变灯头和固定记录图。距离灯塔很远仍运行；共享暂停冻结，恢复不补算，销毁后命令无效。
- 海岸隐藏（全屋全景）只冻结设备运动和测试现实秒，仍同步自动场景日程、午夜与工时，保留原场景时钟行为；否则切回海岸会丢失日序。该规则不等同于共享暂停/后台。没有新增观察者、定时器、持久渲染资源、下载、引擎导入或注册。

## 工程和浏览器检查

[tests.log](tests.log)共215项全部通过，其中[新增16项](../../../../tests/lighthouse-operation.test.cjs)覆盖精确日程、午夜、试灯超时/重叠、分段工时、不同步长的完整24分钟循环、手动重定向、重叠暂停、7日裁剪、不可变/实例隔离和场景销毁。首次边界测试发现先写入18点再判断入夜导致测试标记残留，改为用原实际状态判定后复验通过。

[类型检查](typecheck.log)、[开发构建](development-build.log)、[生产构建及自动发布校验](production-build.log)全部通过。开发输出到`/private/tmp/babylon-lighthouse-operation-phase1-development`，未覆盖验收生产目录。Webpack保留3条既有体积/入口/运行时建议。

[根路径浏览器记录](browser.json)与[子路径记录](subpath/browser.json)使用未改写的最终生产包、Chrome155.0.8059.85、1280×800/DPR1、禁用缓存和已有CDP实例捕获。真实点击时间菜单验证过渡完成才应用目标；地图/设置与hidden重叠、blur/focus、恢复首帧冻结设备；固定手动夜晚连续旋转、重复试灯幂等、自动17:59/18/午夜/06点和住宅视角不使用距离门控、海岸隐藏与销毁均通过。自动段使用统一更新的参考时步，不是帧率或旅行时间测量；hidden用共享暂停接口模拟，未声称操作系统真实休眠实验。

复用[原住宅回归适配器](../scooter-headlight-2026-10-20/check-regression.cjs)得到[本次结果](regression/regression.json)和[日志](regression.log)：8抽屉、8原灯、7门、55段全屋通路、13视角、信件/地图返回、指针锁定、拖动缩放、设置、Inspector、异步书架失败隔离与销毁通过。结果中`baseline`/`suiteOrigin`保留旧套件来源，本次实际输入为`b8d9f12`加本阶段代码；旧证据未改写。故障页的主动书架请求中止单独列在`failurePath`；正常根/子路径与回归页面无页面/控制台错误、警告或404。

三视角的资源、实际灯光和相机逐项等于[原生产基线](baseline.json)，没有用新统计覆盖旧基线。已目视检查[阳台前](before-balcony.jpg)/[后](after-balcony.jpg)、[阅读区前](before-reading.jpg)/[后](after-reading.jpg)、[海岸前](before-coast.jpg)/[后](after-coast.jpg)；海岸JPEG摘要相同，其余未声明逐像素一致。当前每个视角资源保持685网格、575,062顶点、100材质、152纹理、22灯、3相机。

## 独立发布与字节

[发布记录](release.json)校验最终`dist`和根路径/`/home/`全部495文件GET、原始字节与SHA256，包含所有动态调试/编辑器分包、来源许可和清单自身。[完整清单](release-manifest.json)及[依赖分析](bundle-analysis.json)保存实际产物，36运行素材逐项等于前一运行提交清单。

| 指标 | 基线 | 第一阶段 | 变化 |
| --- | ---: | ---: | ---: |
| 两目标GLB | 4,332,840 B | 4,332,840 B | 0 |
| 36运行素材 | 15,867,377 B | 15,867,377 B | 0 |
| 静态初始JS | 2,692,572 B | 2,696,818 B | +4,246 B |
| 实际首屏JS，含必需异步和音频预热 | 2,911,424 B | 2,915,670 B | +4,246 B |
| 完整发布目录，495文件 | 42,324,467 B | 42,328,805 B | +4,338 B |

两个GLB≤4.25MiB、运行素材≤16MiB、实际首屏JS≤3MiB、完整发布≤41MiB，四项原预算全部保持。没有声称加载速度、FPS或显存改善。

## 复跑与限制

1. 运行`npm test`、`npm run typecheck`、`npm run build -- --output-path /private/tmp/babylon-lighthouse-operation-phase1-development`和`npm run build:production`。
2. 用`python3 docs/technical-plans/assets/coastal-cliff-d-2026-10-18/serve-dist.py --port 8214`只托管最终`dist`。
3. 设置`PLAYWRIGHT_PACKAGE`为已安装Playwright包路径；运行本目录`check-browser.cjs`，再以`STUDY_URL=http://127.0.0.1:8214/home/`和独立`STUDY_CHECK_OUTPUT`执行子路径。`--baseline`仅供开发前基线采集，不应改写本次历史证据。
4. 设置`STUDY_URL=http://127.0.0.1:8214/`及本次`STUDY_CHECK_OUTPUT`运行上述原住宅回归适配器；运行本目录`check-release.cjs`检查两个路径和资源摘要。历史复跑应另选输出目录，保留本次记录。

本阶段限Chrome桌面逻辑接入/原功能验收；未重跑WebKit/Firefox/Safari/实机、完整住宅至五层往返、双镜面像素、车辆专项或FPS/GPU/加载耗时实验。后续白闪/灯头、基本面板与局部试灯在第二阶段，巡检/清洁/动态日志在第三阶段，完整真实登塔与跨平台项目收口在第四阶段；未交付内容不能因本次纯逻辑测试被标为已完成。
