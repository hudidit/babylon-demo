# 灯塔天气步骤三：线索与发现验收

日期2026-10-21，输入基线`51a626c`。对应[实施约定与结果](../../2026-10-20-lighthouse-project-03-weather-and-uncertainty.md#步骤三实现及验收记录2026-10-21)。324项测试、类型/开发/生产构建及七套最终同包验收均通过。提交目的“完成灯塔天气风险子项目第三步”，由本目录和源文件Git历史定位。

## 最终包与边界

最终生产清单SHA256：`a152726dab45ed37df23a961a34a9ec03a68e5530d09edb21e481ad543683d96`。[执行记录](run-checks.json)绑定各套脚本/结果摘要，[证据核查](evidence-check.json)核对同包、源码指纹、缓存/发现和预算；[链接检查](links-check.json)验证8份文档的本地链接与锚点。[生产清单](release-manifest.json)、[依赖报告](bundle-analysis.json)和[发布校验](release.json)保留全部交付文件；旧脚本的历史baseline标签不作为本次输入或同包证明，本次以执行记录的输入、脚本摘要及最终清单为准。

本步交付太阳能表面早期薄膜、普通/深入检查、访问缓存、两次漏检后的确定检测提示、修订失效及读数交叉检查。显性污损和保护面盐膜可靠发现，不恢复四组复杂操作；没有新增模块、密封故障、随机扣电或随机扣库存。薄膜2自动小时后成为显性污损，实际太阳能倍率从0.85变为原0.2，沿用原清洁与独立复查。

版本1保存真实设备/Wh/修订和已取得的纸质文字，不保存天气与本次线索缓存；界面明确继续后重建访问、旧污损按可见状态恢复并需复查。独立知识检查点的测试通过不代表已完成完整存档。跨刷新保持同一问题/随机/访问、版本2迁移及演练隔离留步骤四；统计平衡与综合发布留步骤五，天气预报仍未交付。

## 工程与现场证据

| 验收 | 实际结果 | 记录 |
| --- | --- | --- |
| 工程 | 324项测试通过，新增13项；类型检查、开发/生产构建及发布校验通过；生产仍有原3项webpack体积建议 | [测试](tests.log)、[类型](typecheck.log)、[开发](build-development.log)、[生产](build-production.log) |
| 新发现流程 | 原默认风险参数、种子216，经43,800次原0.1秒有界时钟回调自然到第4日产生薄膜；重复巡视只抽一次、普通检查没有虚假“无故障”结论；离开区域10分钟后第二次漏检给出5秒细查提示，确定诊断/清洁/证据失效/复查/中断/保存文字通过 | [脚本](check-discovery.cjs)、[完整结果](discovery/discovery.json)、[日志](discovery.log) |
| 原维护闭环 | 合法模型生成的第6日版本1夹具通过原生继续载入；真实巡视、风雨擦拭中断且不扣料、晴后完整擦拭/复查、雾中保存和继续边界通过；原生W撤回保持 | [现场结果](work/work.json) |
| 四天气回归 | 根与子路径日夜住宅/途中/塔顶及双卫、实际几何雾/镜面/雨线GPU、海雾一小时真实Wh、界面/失焦暂停及返回、三视口通过 | [天气结果](weather/weather.json) |
| 双引擎画面 | Chrome155.0.8059.86/WebKit27.2 × 三视口 × DPR1/2：96个天气日夜帧，另12个晴天恢复帧像素差异均0 | [矩阵](matrix/matrix.json) |
| 原住宅与生命周期 | 8抽屉、8灯、7门、55段通行与室内/地图/物品/设置/Inspector等原回归、3轮应用创建/释放通过 | [回归](regression/regression.json)、[重建](recreate/recreate.json) |
| 独立交付 | 只托管dist，根及`/home/`各495文件GET/长度/SHA256通过，36运行素材与步骤二完全一致 | [发布](release.json) |

现场新流程用初始化前的固定熵夹具，未直接写污损、Wh、日序或检查证据；调用原生产共享时钟并保留默认风险率，不能称为现实多日手工游玩。镜头用同楼面站稳位置夹具，区域重访通过位置夹具离开/返回，不能称为全程原生步行；原风雨套件另有真实W撤回。纯逻辑测试的饱和风险参数仅用于边界，不用于玩法频率结论。

发现流程采集运行错误与告警均为空；天气/矩阵也为空，原回归的预期负向路径按原断言保留。新发现现场仅在Chrome执行；WebKit本轮结论是天气画面矩阵。没有Safari/Firefox/物理设备、FPS、加载耗时、真实故障率或真实航标规范结论。

[两次漏检提示](discovery/two-misses.jpg)、[细查进度](discovery/deep-progress.jpg)、[确认薄膜](discovery/confirmed-film.jpg)、[诚实纸质记录](discovery/honest-paper.jpg)、[清洁后旧证据失效](discovery/stale-after-clean.jpg)、[独立复查](discovery/independent-recheck.jpg)、[保存边界](discovery/save-boundary.jpg)记录核心流程。另有[桌面](discovery/patrol-1280x800.jpg)、[竖屏](discovery/patrol-390x844.jpg)、[横屏](discovery/patrol-844x390.jpg)，无页面横向溢出。

## 字节与资源

| 指标 | 步骤二 | 本步 | 预算 |
| --- | ---: | ---: | ---: |
| 两目标GLB合计 | 4,332,840 B | 4,332,840 B | 4.25 MiB |
| 36项运行素材 | 15,867,377 B | 15,867,377 B | 16 MiB |
| 静态初始JS | 2,825,703 B | 2,835,996 B | 3 MiB |
| 实际首屏JS，含必需异步 | 3,044,555 B | 3,054,848 B | 3 MiB |
| 完整发布目录，含全部动态分包及说明 | 42,491,747 B | 42,502,754 B | 41 MiB |

首屏增加10,293 B，完整目录增加11,007 B，预算不变。根与子路径实际首屏同为3,054,848 B，见天气请求及发现流程响应体记录；静态入口没有替代异步统计。场景仍715网格、575,264顶点、22灯，模型/素材/依赖/引擎注册及网格、材质、相机、RTT数量无新增。本步只改已有表面的状态/顶点色，不更换运行资产。体积统计不推导加载速度或FPS收益。

## 复现与诊断

在仓库根执行`npm run typecheck`、`npm test`；开发构建输出至独立临时目录，再执行`npm run build:production`。用[node独立托管脚本](serve-dist.cjs)启动最终dist（默认8254端口）；设置`PLAYWRIGHT_PACKAGE`为本地Playwright Core入口、`PLAYWRIGHT_BROWSERS_PATH`为匹配的WebKit目录，执行`node docs/technical-plans/assets/lighthouse-weather-step3-2026-10-21/run-checks.cjs`，最后执行同目录`verify-evidence.cjs`。原复用脚本的固定基线标签由同包执行记录加以限定，历史脚本和历史结果不改写。

本轮Node24.21.0、TypeScript5.9.3、webpack5.111.1、临时Playwright Core1.64.1；临时客户端不进入项目依赖。`--reuse-discovery`仅复用同清单且已完成的发现结果，本轮新流程先独立执行成功，再顺序执行六套回归，避免重复模拟；[源码指纹](source-fingerprints.json)保护其间无运行源码变化。

首轮现场脚本手动选时后忘记重新启用自动流转，60,000次回调均未推进天气风险，未通过的结果仅存于[诊断](diagnostics/clock-paused-discovery.json)和[错误日志](diagnostics/clock-paused.log)。修正测试设置、明确开启自动后重跑本生产包通过，没有放宽产品的暂停规则或提高风险率。
