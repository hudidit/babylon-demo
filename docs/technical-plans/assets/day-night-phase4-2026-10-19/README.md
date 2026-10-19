# 时间流转第四阶段：整体验收与交付

日期：2026-10-19；输入提交`69606ac`；状态：工程与可用Chrome/WebKit交付已完成，Firefox/Safari/物理设备未验。范围见[总方案](../../2026-10-19-day-night-cycle.md)第7.1/7.2/13节。保留历史阶段证据，本目录单独记录当前生产版本的整体结果。本阶段运行代码、素材、依赖、构建配置及预算均未改变，新增的是验收脚本、证据和文档。

## 验收方式与边界

- 工程检查依次执行单元测试、类型检查、临时开发构建、生产构建与自动发布校验。浏览器只访问最终`dist`，服务器无`public`回退；根路径和`/home/`全部分包、说明及清单均做GET/字节/SHA256核对。
- Chrome通过调试器取得已存在的RoomScene用于状态读取与参考步长；跨引擎只读取现有引擎、真实点按菜单，并用原`onBeforeRenderObservable`回调推进自动时钟。生产包没有替换或插入测试接口。固定步长、逻辑帧回调和镜头夹具只验证功能，不是FPS、GPU、网络耗时、实际旅行时间或24分钟实时设备录像。
- 八节点截图使用相同阳台/次卧窗/房外/步道/塔前/车体姿态；午夜全路线只在住宅起点设置一次位置，此后使用真实输入，直到实际步行返回住宅才调用地图回家。镜面使用真实RTT像素和物体/门/灯变化，不用静态截图代替动态反射验证。
- Chrome/WebKit三视口×DPR1/2是模拟屏幕/触控，不能写成Safari、iPhone或Android实机。Firefox/Safari重新探测的原始结果单列，不能算作通过；本次没有开启浏览器远程自动化设置或使用物理设备。此前暂停的性能实验保持暂停。

## 已完成检查

- [tests.log](tests.log)：184项全通过，含pure独立进程注册、时钟/角度/地平线/回卷、过渡与重叠暂停、自然/人工阴影隔离以及原住宅/载具/灯塔/发布负向测试。
- [类型检查](typecheck.log)、[临时开发构建](development-build.log)、[生产构建](production-build.log)：全部通过，Webpack保留3条既有性能建议。生产预算及模块守卫未调整，[依赖分析](bundle-analysis.json)与第三阶段一致。
- [八节点结果](visuals.json) / [check-visuals.cjs](check-visuals.cjs)：真实菜单完成八个目标后，在六视角保存48图；同批主光、天空/海面、窗光、IBL与不变的人工灯状态通过。另有4个光盘、4个晨昏交接及3个夜灯画面，32次近宅→途中→塔区→近宅锚点检查保持当前光向；实际首屏12 JS、2,897,086字节，无错误/警告/404。
- [光盘像素](sky-alignment.json)、[晨昏像素](twilight-continuity.json) / [只读分析](check-sky-alignment.py)：四光盘核心质心偏差最高0.144px；交接前后各0.0001小时的天空/海面区域通道平均绝对差低于0.04/255。分析未修改图片，不作为性能指标。
- [跨引擎矩阵](engines/matrix.json) / [check-matrix.cjs](check-matrix.cjs)：Chrome155.0.8059.82/WebKit27.2×1280×800、390×844、844×390×DPR1/2，共12组、96次节点和36段自动流转检查通过，36图归档。每组检查菜单/44px目标/触控/滚动、18点后无直接光的暮光、21→00与00→03→06的连续参数、停止精确状态、资源与释放；正常错误/警告/404为零。

## 集成验收

按[run-checks.cjs](run-checks.cjs)顺序执行的11个套件全部通过，[run-checks.json](run-checks.json)保存实际脚本路径/摘要、结果和退出码；仅对失败或修正后的项复跑，原通过项没有反复覆盖。[机器汇总](acceptance-summary.json)与[一致性检查](verify-evidence.cjs)同时核对执行脚本摘要、历史来源未改、全部结果及发布清单，明确通过范围与未验平台。

| 总方案检查项 | 本轮实际结果与证据 |
| --- | --- |
| 手动过渡、循环、UI/暂停 | [controls.json](controls.json)：八节点、快速改选、25个50ms参考帧、完整24分钟时钟模拟、10Hz批次、长帧/失焦/隐藏/重叠原因、步行/骑乘T菜单、焦点/锁定和0.2秒减少动态效果通过。新增实际点开信件详情时自动暂停、关闭首帧不累计而第二帧恢复；Inspector内部隐藏解除暂停，释放后菜单事件不再响应 |
| 午夜连续路线与灯塔 | [journey.json](journey.json)：起点仅一次定位后以真实输入经139点到塔，五层上下/每层离梯、32点绕外廊，再经139点步行回住宅。午夜由真实T菜单选定；新增实际爬梯中T暂停/收起/点击恢复，保留地图/设置/Esc/预设各恢复路径，途中没有修正位置或梯高度 |
| 双卫动态镜面 | [主卫像素](mirrors/master/mirror-map.json)/[公卫像素](mirrors/public/public-mirror.json)：午夜实际RTT随真实物体、门/灯/视角变化；隐去物体分别改变5,119/2,088像素，恢复后摘要恢复；主卫离屏/背面刷新门控与两张512²目标通过 |
| 原住宅功能 | [regression/regression.json](regression/regression.json)：8抽屉/8灯/7门、推拉门/扫掠保护、55段八房通行、地图/详情隔离、第一人称指针、拖动缩放、设置/Inspector、家具失败隔离及释放通过 |
| 跳跃与走下平台 | [jump/jump.json](jump/jump.json) / [check-jump.cjs](check-jump.cjs)：真实空格触发，固定1/60秒参考帧；床/沙发/茶几/椅/阳台/地板六落点通过，实际W走下床后回到地面，画布聚焦时全景空格无位移。独立位置夹具同步相机、previousWalk和跳跃状态，不把这些夹具当作连续走到家具的路线 |
| 小电驴 | [browser.json](browser.json) / [check-scooter.cjs](check-scooter.cjs)：六位置40km/h与继续加速、护栏/塔基/住宅三类高速阻挡、空格刹车/低速倒车/地图暂停/安全下车/Inspector通过；浏览器和应用锁定、控制就绪均显式等待，六例前/输入后/积分后状态保留。为位置/速度隔离夹具，不推断全程实骑耗时 |
| 异步与失败 | [lifecycle.json](lifecycle.json)：在切午夜的混合过渡中释放书架请求，晚到材质按当前环境系数0.766666…接入；HDR主动中止后0/12/06/21菜单仍可用，失败IBL保持零。4条预期网络错误单列，无未捕获异常；梯上附件/位置及重复销毁通过 |
| 三轮应用重建 | [recreate.json](recreate.json) / [check-recreate.cjs](check-recreate.cjs)：取得原应用构造器后在同一DOM连续创建/销毁三轮，各轮重新默认正午，菜单/自动仍可用；释放后网格/材质/纹理/灯/相机/帧观察者/引擎场景计数均0。document及时间入口事件清空，window的resize/blur/focus/pagehide监听移除，剩余输入监听数量固定；各轮活跃监听数量一致。未测量进程内存/显存 |
| 独立发布与子路径 | [subpath.json](subpath.json)：`/home/`的午夜菜单/自动、地图回家、T/第一人称保持、Inspector及JS前缀通过；[release-check.json](release-check.json)验证根/子路径各495文件，包含全部未触发动态分包、来源说明与清单自身。495文件均与第三阶段相同 |

正常矩阵/路线/镜面/原住宅/跳跃/载具/重建无页面错误或缺失请求。控制套件打开Inspector后记录1条第三方`slider-vertical`兼容提示，HDR负向页的故意中止网络错误独立列出，不能写成所有页面“零错误/零警告”。旧套件报告中的历史`baseline/suiteOrigin`仅表示套件来源，当前执行提交、脚本路径/摘要及输出位置以本目录runner为准。

## 平台与脚本问题记录

[platform-availability.json](platform-availability.json) / [check-platforms.cjs](check-platforms.cjs)：Firefox Nightly在20秒内未建立会话，原始日志包含sandbox extension与SWGL帧缓冲错误；Safari WebDriver服务可响应状态请求，但创建会话在20秒后超时，未取得可用Safari会话，不能据此推断具体设置状态。两者未验，物理设备未使用。

跨引擎首轮脚本错误假设生产包会导出内部RoomScene类，[首轮结果](attempts/matrix-export-assumption.json)和[日志](attempts/matrix-export-assumption.log)保留。生产scope hoisting使该类留在模块内部，脚本改为只读取引擎、用原帧观察者及真实菜单验证后，12组全部通过。没有改运行代码、放宽功能断言或把失败组合计为通过。[suite-sources.json](suite-sources.json)记录沿用脚本的历史来源与输入摘要，历史文件和测量未覆盖。

旧跳跃套件[首轮失败](attempts/jump-legacy-fixture.log)后，用[诊断脚本](diagnose-jump.cjs)和[原始状态](attempts/jump-diagnosis.json)确认：相机被移到床位`[-16.5,3,15.25]`，previousWalk仍是住宅出生点`[20,3,-0.25]`；按空格前就被通行扫掠限到`[3.9308,3,6.5739]`。最终同步初始夹具，原六个目标高度和检查保留，额外验走下床；没有绕过运行碰撞。[全景探针另一次](attempts/jump-before-orbit-focus.log)仅因`83.99999999999999`与`84`全等失败，对应[状态](attempts/jump-before-orbit-focus.json)保留；最终聚焦画布、预热两帧，并按`1e-8`世界单位检查无位移，排除浮点舍入与原预设按钮的默认空格点击。

载具[首轮记录](attempts/scooter-initial.json)/[日志](attempts/scooter-initial.log)在首例录得0速度，原脚本未保留应用锁定/暂停状态，不能据该记录确定根因。[补充状态探针的复验](attempts/scooter-with-state-probes.json)通过；最终显式等待浏览器锁定、应用锁定、控制及前台均就绪，并保留六例前后状态，再次通过全部检查。运行代码及40km/h、阻挡、暂停等功能断言未改变。

## 发布与资源

| 指标 | 第三阶段 | 第四阶段当前生产包 |
| --- | ---: | ---: |
| 两目标GLB | 4,332,840 B | 4,332,840 B |
| 36运行素材 | 15,867,377 B | 15,867,377 B |
| 静态初始JS | 2,678,234 B | 2,678,234 B |
| 实际首屏JS（含必需异步） | 2,897,086 B / 12文件 | 2,897,086 B / 12文件 |
| 完整发布（含清单自身） | 42,309,856 B / 495文件 | 42,309,856 B / 495文件 |

最终495文件与第三阶段逐字节一致；[发布清单](release-manifest.json)与[独立托管结果](release-check.json)留档。670网格/570,475顶点、95材质/148纹理/17灯/3相机不变，无新增RTT或下载。GLB≤4.25MiB、素材≤16MiB、首屏JS≤3MiB及完整发布≤41MiB预算保持；不声称加载或FPS收益。

## 复跑

在仓库根目录执行`npm test`、`npm run typecheck`、`npm run build -- --output-path /private/tmp/babylon-day-night-phase4-dev`、`npm run build:production`。仅托管最终生产目录：`python3 docs/technical-plans/assets/coastal-cliff-d-2026-10-18/serve-dist.py --port 8196 --root <仓库绝对路径>/dist`。

本目录Node脚本使用`PLAYWRIGHT_PACKAGE=/private/tmp/dsh-playwright/node_modules/playwright-core`、`STUDY_URL=http://127.0.0.1:8196/`；矩阵另设`PLAYWRIGHT_WEBKIT_EXECUTABLE=/private/tmp/study-audio-test-browsers/webkit-2336/pw_run.sh`。平台探测另设`PLAYWRIGHT_FIREFOX_EXECUTABLE=/private/tmp/study-audio-test-browsers/firefox-1538/firefox/Nightly.app/Contents/MacOS/firefox`。先执行平台探测、`check-visuals.cjs`及`check-matrix.cjs`，再执行`run-checks.cjs`；可用套件名称参数仅复跑受影响项。镜面/原住宅的历史套件由runner将输出明确转入本目录，跳跃使用本轮同步夹具版本。像素分析使用本机bundled Python/Pillow。这些工具是已有本地测试环境，不是项目依赖。

工程与可用平台范围已经交付，无待开发功能。后续复验另建输出目录，不覆盖本轮证据；完整跨平台结论仍需可用Firefox/Safari与物理设备，主观听感和暂停的性能实验不在本轮通过范围。单张中性IBL和远处长影的局部覆盖近似继续沿用总方案第5节，不冒称物理天文/全局光照。提交入口：`git log --follow -- docs/technical-plans/assets/day-night-phase4-2026-10-19/README.md`，提交目的“完成时间流转第四阶段整体验收与交付”。
