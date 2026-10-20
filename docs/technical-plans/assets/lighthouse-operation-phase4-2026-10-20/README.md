# 灯塔子项目一第四阶段综合验收

日期：2026-10-20。实施基线`8aea9e9`，范围为[详细方案](../../2026-10-20-lighthouse-project-01-core-loop.md)“四 独立交付与收口”。状态：工程/可用浏览器交付完成。额外WebKit8日压力、受限平台与暂停性能实验分别保留边界。

本轮运行代码、资源、依赖和发布配置保持第三阶段交付。新增综合验收入口和证据，历史套件通过[适配器](suite-adapter.cjs)在本目录产生新结果；业务断言只调整当前41个交互对象/8个车辆网格计数，另调整输出位置与平台探测日期/端口。结果的`sourceBaseline`保留套件来源，`baseline`明确为本次`8aea9e9`，不将旧结果当本轮通过证据。元数据`stage: 3`仍表示三项巡检功能已实现，第四阶段是交付验收状态。

## 工程和生产基线

[235项测试](tests.log)、[类型检查](typecheck.log)、[开发构建](development-build.log)、[生产构建/自动发布校验](production-build.log)通过。开发输出为`/private/tmp/babylon-lighthouse-operation-phase4-development`，未覆盖生产包。Webpack保留3条体积/入口/分包建议，不属于浏览器运行告警。

最终生产清单SHA256为`76042f0795317efda7eb3aa51f9fec7fb52c88fee718212fd515de0a2cdaab02`。生产清单与第三阶段逐字节一致，未改写bundle、着色器或生产调试入口；浏览器仅访问独立托管的dist。

## 巡检和原功能

| 范围 | 本轮结果与证据 |
| --- | --- |
| 根/子路径局部操作 | [根路径](browser/browser.json)/[日志](browser.log)、[子路径](subpath/browser.json)/[日志](subpath.log)通过：首层真实读数确认/重复幂等，顶层局部试灯/30秒超时/夜间导航优先，暂停/ESC/Tab/返回和命令重验；转头重置观察，地图/失焦/转头/试灯/18点起灯中断擦拭，取消保留污损，清洁后独立复查，自动换日保留洁净 |
| 连续完整路线 | [路线结果](journey/journey.json)/[日志](journey.log)通过：仅在住宅入口设置一次起始姿态，之后真实W/S/E/点击与原控制更新，不纠正位置或梯高；去返各139路点、4次上/4次下、32段外廊；完成三项检查、取消后重做/复查，下塔从[原记录夹查看完整摘要](journey/journey-session-journal.jpg)，返回住宅观察夜间白闪，ROI亮度约27.706～49.762 |
| 双引擎画面 | [矩阵](matrix/matrix.json)/[日志](matrix.log)通过：Chrome155.0.8059.85/WebKit27.2 ×1280×800/390×844/844×390 ×DPR1/2；24组近/远景方向白闪、12组盐膜/洁净GPU对比。最小近景增量170.915、近宅增量1.170；盐膜前后96×DPR像素ROI平均RGB差36.903～37.722，材质均就绪 |
| 原住宅/调试 | [回归](regression/regression.json)/[日志](regression.log)通过：8抽屉/8原灯/7门、55段全屋通路、13视角、信件/地图/原位/拖动缩放/设置/Inspector、书架失败隔离及释放 |
| 双卫实际反射 | [主卫](master-mirror/mirror-map.json)/[日志](master-mirror.log)、[公卫](public-mirror/public-mirror.json)/[日志](public-mirror.log)通过：午夜实际512²反射像素，隐藏/恢复马桶改变5,119/2,088像素且恢复摘要一致；灯开关、门、视角与镜面门控保持，无镜面prepass或新增相机 |
| 窗帘/主照明 | [六窗帘](curtains/browser.json)/[日志](curtains.log)、[四房主灯](ceiling/browser.json)/[日志](ceiling.log)通过：真实关闭/反向/重开、日夜状态/地图暂停和第一人称；四房00/03/12/21点照明/实体开关，原灯状态及资源数保持 |
| 车辆/夜间车灯 | [驾驶](scooter/browser.json)/[日志](scooter.log)、[前照灯](headlight/browser.json)/[日志](headlight.log)通过：六处40km/h和加速、三类高速阻挡、刹车/倒车/地图/安全下车；实际E上车及W驾驶，车头/转向跟随、日夜过渡/设置/地图/后台/预设与回家/释放。固定路面ROI灯开/关约19.085/17.425；这些姿态夹具不替代新全程驾驶或性能实验 |
| 连续时钟/日序/刷新 | [汇总及新会话](continuity/continuity.json)/[日志](continuity.log)通过：核验同一生产包中已经完成的Chrome8个/WebKit4个完整24分钟参考循环，每引擎首日24个整点证据；18点起/6点停、自动午夜、累计96/48场景运行小时、无人观察不补发检查、设置/失焦/隐藏冻结与首帧不补算。Chrome推进至第9日，摘要和事件只留第3～9日，WebKit推进至第5日。新开两引擎会话重验住宅远离灯塔时一圈运动、自动时间、重复释放及刷新恢复第1日12点/盐膜/待检查 |
| 资源异步/失败与生命周期 | [生命周期](lifecycle/lifecycle.json)/[日志](lifecycle.log)通过：晚到书架17个材质在手动过渡中继承当前环境，HDR失败下0/12/6/21点四节点保持正确降级与云星同步，梯中菜单暂停及重复销毁；主动中止HDR的4条`net::ERR_FAILED`单列，未捕获异常为空 |
| 重复创建/释放 | [三轮应用重建](recreate/recreate.json)/[日志](recreate.log)通过：同一页面捕获原应用构造器，三轮重建保持资源与DOM监听数、固定云星像素摘要一致；默认12点、自动流转/菜单恢复，释放后网格/材质/纹理/灯/相机/观察回调/引擎场景全部为0，旧菜单事件失效 |

[擦拭可见](browser/cleaning-visible.jpg)、[完整摘要](browser/round-complete.jpg)、[WebKit竖屏盐膜](matrix/webkit-portrait-salt-dpr2.jpg)/[洁净](matrix/webkit-portrait-clean-dpr2.jpg)及横屏住宅白闪已目视核对。方向/盐膜GPU矩阵暂停Room回调、固定真实几何/材质参数，只作组件画面对比；业务计时、清洁提交与连续旅行由独立套件验证。

主巡检、矩阵及带相应监听的正常住宅/窗帘/主灯/车辆套件没有控制台/页面错误、警告或404。失败隔离、平台启动和主动中止压力夹具的诊断单列，不混入正常访问结论。

## 独立发布、证据一致性与平台

[发布结果](release.json)/[日志](release.log)确认根路径和`/home/`各495文件GET、原始字节及SHA256通过，包含全部动态调试/编辑器分包、来源/许可、分析及清单自身。36运行素材摘要不变，所有生产文件与第三阶段相同；[清单](release-manifest.json)和[依赖分析](bundle-analysis.json)均与最终dist逐字节一致。

[串行检查汇总](run-checks.json)完成14个功能/画面/生命周期入口、1个发布入口及1个平台可用性探测；平台探测完成只表示得到可用性结果。[综合核验](evidence-check.json)逐项检查实际脚本、适配器、结果和同一生产清单的SHA256，核对8份文档链接、源码无运行差异及全部预算，防止跨包或旧结果拼接。所有本轮文件随代码基线、方案、索引和CHANGELOG一同提交，提交标识由Git历史定位。

[平台探测](platforms/platform-availability.json)/[日志](platforms.log)使用已有运行包和临时配置，没有改变自动化安全设置。Chrome155.0.8059.85/WebKit27.2已完成上述对应检查；Firefox启动15秒超时并有SWGL/framebuffer及扩展沙盒错误，Safari会话500明确要求开启远程自动化。两者均未进行本轮功能验收，物理设备未提供。额外WebKit8日压力整体未完成，不与已通过4日组件混为一谈。

## 资源预算

| 指标 | 第三阶段 | 本轮生产包/实测 |
| --- | ---: | ---: |
| 两目标GLB | 4,332,840 B | 4,332,840 B |
| 36运行素材 | 15,867,377 B | 15,867,377 B |
| 静态初始JS | 2,726,105 B | 2,726,105 B |
| 根/子路径首屏JS，含必需异步和音频预热 | 2,944,957 B | 2,944,957 B |
| 本轮请求窗口保守上界 | 未单列 | 2,948,280 B |
| 完整发布，495文件 | 42,369,441 B | 42,369,441 B |

前照灯套件在场景就绪后捕获实例并绘制参考帧，再记录初始请求，窗口额外包含既有`js/1442.js`（Babylon DumpTools，3,323 B）；根/子路径均为12个JS，该窗口为13个。保守上界全部计入，仍低于3MiB，不能因它属于异步工具而删掉。该差异来自采样窗口，生产清单/分包摘要未变，不算代码体积回退或优化收益。

场景保持693网格/575,224顶点/103材质/152纹理/22灯/3相机；相对子项目一开始前累计净增8网格/162顶点/3材质，无新下载、光源、相机、RTT或阴影图。四项硬预算不调整。运行素材来源沿用[既有发布说明](../../../../public/STUDY_ASSET_SOURCES.md)和[机器记录](../../../../public/environment/coastal-cliff-source.json)。

## 诊断与复跑

- 首次在沙盒中绑定本机端口/启动Chrome失败，保留[服务器诊断](diagnostic-sandbox-server.log)和[浏览器诊断](diagnostic-sandbox-browser.log)。经工具权限校验后使用原检查和临时浏览器配置运行，未改安全设置或使用用户已有浏览器配置；失败不计为通过证据。
- 新多日夹具最初直接读取尚未首次发布的`timeOfDay.playback`，保留[诊断结果](diagnostic-continuity-metadata.json)/[日志](diagnostic-continuity-metadata.log)。初始自动状态改读真实时间菜单复选框，后续仍由原生产观察回调推进。未改变应用时钟、放宽产品接口或替换运行模型。
- 额外压力目标最初为每引擎8个完整昼夜。Chrome完成8日和刷新检查；WebKit长时间执行密集参考回调，完成4日，在第5次循环期间由本轮主动结束其临时内容进程。因此[原始结果](diagnostic-eight-day-stress.json)/[日志](diagnostic-eight-day-stress.log)/[实际脚本](diagnostic-eight-day-stress.cjs)保留整体未通过及主动关闭异常，不能称WebKit8日通过，也不能当成产品自然崩溃。[来源绑定](diagnostic-eight-day-stress-provenance.json)保留原结果/脚本SHA256、原失败套件与生产清单；正常页面错误数组在已完成组件内为空。
- 综合收口改为审计已完成的Chrome8日/WebKit4日及各自首日24个检查点，并新增两引擎有限新会话/刷新检查。每个已经完成的周期都重新核验时刻、运行状态、日序/工时、证据未凭空完成、摘要和事件裁剪；不使用尚未返回的第5日WebKit结果。完整昼夜和7日裁剪的交付标准已覆盖，额外WebKit8日压力列为未完成的补验项，`stressAttemptPassed`保持`false`。不通过这次执行耗时或单次进程诊断推断FPS、加载速度或内存收益/回退。

先执行`npm test`、`npm run typecheck`、`npm run build -- --output-path /private/tmp/babylon-lighthouse-operation-phase4-development`和`npm run build:production`。使用`python3 docs/technical-plans/assets/coastal-cliff-d-2026-10-18/serve-dist.py --port 8217`仅托管dist。

本机[环境及版本](environment.json)记录Node24.21.0、Babylon9.30.0、TypeScript5.9.3、Webpack5.111.1和Playwright1.64.1。设置`PLAYWRIGHT_PACKAGE=/private/tmp/dsh-playwright/node_modules/playwright-core`、`PLAYWRIGHT_WEBKIT_EXECUTABLE=/private/tmp/study-audio-test-browsers/webkit-2336/pw_run.sh`、`PLAYWRIGHT_FIREFOX_EXECUTABLE=/private/tmp/study-audio-test-browsers/firefox-1538/firefox/Nightly.app/Contents/MacOS/firefox`、`STUDY_URL=http://127.0.0.1:8217/`，串行执行本目录`run-checks.cjs`，最后执行`verify-evidence.cjs`。工具路径属于本机已有运行包，不是应用依赖。复跑应另建证据副本，避免覆盖历史；可按套件名选跑，汇总校验会拒绝缺项、摘要不符或跨生产包拼接。

默认`continuity`会审计已绑定的周期数据并重新运行有限新会话；若要重新生成完整多日数据，另设`STUDY_CHECK_OUTPUT`执行`diagnostic-eight-day-stress.cjs`，按实际完成组件留档并重新绑定来源，不能覆盖诊断后沿用旧摘要。这项额外压力可能长时间运行，不属于默认快速复核。

本轮不恢复此前暂停的FPS、GPU耗时或加载速度实验。固定50/100ms步长、静态截图及ROI只证明对应功能/像素，不代表实机性能或实际航海射程。子项目二的主备/电池/故障/本地保存、子项目三的天气仍按各自方案待实施。
