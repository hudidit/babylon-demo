# 灯塔子项目二步骤一：设备和空间

日期：2026-10-20。实施基线及前项验收提交`8e6e255`，范围对应[详细方案](../../2026-10-20-lighthouse-project-02-equipment-and-maintenance.md)“一 设备和空间”。状态：工程/可用浏览器验收完成。方案、总入口、索引和CHANGELOG同步收口，后续步骤未提前交付。

本步安装七类设备，提供可读铭牌与中文只读说明、同源碰撞和空间站位。备用灯熄灭、机组关闭，新增供电设备未投运；不显示虚构电量/功率，不开放步骤二的自检/接替/隔离/维修或步骤三的补能。主灯、原面板、试灯、三项巡检、保护面和工作灯保持原运行职责。

## 实现、资源及工程

[同源布局](../../../../src/examples/LighthouseEquipmentLayout.ts)是设备标识、用途、铭牌、边界与实体尺寸的共同入口，[设备几何](../../../../src/examples/LighthouseEquipment.ts)复用四种既有材质，新增太阳能片/铭牌两种材质及一张256×512原创字形图集。主灯检修口留在原0.44m保护范围内；首层右侧为封闭电池柜及控制器；屋檐外高位备用灯从有效外廊站位可见；塔后机房/太阳能架保留原入口、5.5m绕塔路线、停车和护栏。机房仅步行进入，机座前有站位、两侧真实通风孔及外部排气，地图外廓同源。

新增23网格/1,560顶点/2材质/1生成纹理，无新下载、灯、相机、RTT或阴影目标；独立设备预算≤24网格/20,000顶点/6新增材质，旧外景额度继续单独检查。最终场景716网格/576,784顶点/105材质/153纹理/22灯/3相机。资源来源见[发布说明](../../../../public/STUDY_ASSET_SOURCES.md)及[机器记录](../../../../public/environment/coastal-cliff-source.json)的`lighthouseEquipment`。

[243测试](tests.log)、[类型检查](typecheck.log)、[开发构建](development-build.log)、[生产构建及自动发布校验](production-build.log)通过。开发输出在`/private/tmp/babylon-lighthouse-equipment-step1-development`，没有覆盖最终dist；生产构建保留3条既有Webpack体积建议。

## 浏览器与独立发布验收入口

[串行执行清单](run-checks.json)由[入口脚本](run-checks.cjs)运行，历史套件通过[适配器](suite-adapter.cjs)保存到本目录，不覆盖旧证据。适配更新新增后的153纹理、48交互对象和8车辆网格计数及输出位置，并在连续路线截图期间冻结活跃计时，保留原业务断言；各结果的`sourceBaseline`保留来源，`releaseManifestSha256`绑定本次生产包。

| 检查 | 证据及范围 |
| --- | --- |
| 七类设备、根/子路径 | [根路径](equipment/equipment.json)/[日志](equipment.log)、[子路径](subpath/equipment.json)/[日志](subpath.log)：真实局部点击与距离/实体拾取，三种视口、Tab/返回、只读状态、不代做巡检、查看时暂停；原W输入连续进出机房、机组与太阳能架阻挡、HUD及释放 |
| 原运行与巡检 | [局部回归](browser/browser.json)/[日志](browser.log)：原首层确认、顶层试灯、保护面清洁/取消/复查、自动日程/午夜、暂停与命令重验 |
| 全程步行/五层/外廊 | [连续路线](journey/journey.json)/[日志](journey.log)：住宅入口仅一次起始姿态，随后真实W/S/E/点击，去返各139路点、4次上/4次下、32段外廊、完整三项巡检及原记录夹，再返回住宅看夜间白闪；不校正中途位置或梯高 |
| 原住宅与调试 | [回归](regression/regression.json)/[日志](regression.log)：8抽屉/8原灯/7门、55段全屋通路、13视角、信件/地图/设置/Inspector、书架失败隔离与释放 |
| 窗帘与四房主灯 | [窗帘](curtains/browser.json)/[日志](curtains.log)、[主灯](ceiling/browser.json)/[日志](ceiling.log)：六窗开合/反向和日夜保持，四房00/03/12/21点及原开关 |
| 双卫实际镜面 | [主卫](master-mirror/mirror-map.json)/[日志](master-mirror.log)、[公卫](public-mirror/public-mirror.json)/[日志](public-mirror.log)：午夜真实反射、隐藏/恢复物品像素差、门灯和视角门控 |
| 车辆与前照灯 | [结果](headlight/browser.json)/[日志](headlight.log)：真实E上车/W驾驶、车灯随车头/转向/日夜、停车/安全下车/暂停/回家及释放；本轮停车与新增设备碰撞还由共享控制器测试保护，不将姿态夹具当全程驾驶 |
| Chrome/WebKit设备画面 | [矩阵](matrix/matrix.json)/[日志](matrix.log)：两引擎×三视口×DPR1/2，共60个设备隐藏/恢复GPU对比，包含实际外廊站位的备用灯及电池柜、太阳能、机房/机组；原材质就绪，保留近景截图 |
| 完整根/子路径交付 | [结果](release.json)/[日志](release.log)、[清单](release-manifest.json)、[依赖分析](bundle-analysis.json)：各495文件GET、字节和SHA256，含全部动态分包、来源/许可、报告和清单自身；36运行素材与基线摘要一致 |

最终各项结果及脚本摘要由[一致性检查](verify-evidence.cjs)核对，[汇总](evidence-check.json)记录同包验证、原始请求窗口、源码摘要及本地文档链接。组件相机只用于画面检查，业务走动与巡检由独立真实输入套件验证。完整日序压力沿用子项目一的历史证据，本步未重跑多日压力或三轮应用重建，不冒充本轮新增验收。

12个套件全部通过，绑定最终生产清单SHA256 `1acb19a6038c274885e4884d860bb6de99f8f37f75b2822b6963de242190e4b1`。Chrome155.0.8059.85/WebKit27.2完成60个设备GPU对比，两引擎/三视口/DPR1/2均通过；新增设备材质就绪，正常设备与矩阵没有控制台/页面错误、警告或404，其余诊断与告警以各原始记录为准。

[设备区总览](matrix/chromium-site-overview.jpg)、[PV受光面](matrix/chromium-desktop-solar-dpr1.jpg)、[实际外廊所见备用灯](matrix/chromium-desktop-backup-gallery-dpr1.jpg)、[机房入口与机组](matrix/chromium-desktop-room-dpr1.jpg)、[中文设备说明](equipment/lighthouse-generator-info.jpg)已目视核对。最终修正后的太阳能受光面和网格可见，备用灯没有被屋檐完全遮住；不能仅靠组件隐藏/恢复的数值差判定美术正确。

## 字节预算

| 指标 | `8e6e255`基线 | 本步生产包 |
| --- | ---: | ---: |
| 两目标GLB | 4,332,840 B | 4,332,840 B |
| 36运行素材 | 15,867,377 B | 15,867,377 B |
| 静态初始JS | 2,726,105 B | 2,740,505 B |
| 根/子路径首屏JS，含必需异步与音频预热 | 2,944,957 B | 2,959,357 B |
| 请求窗口保守上界 | 2,948,280 B | 2,962,680 B |
| 完整发布，495文件 | 42,369,441 B | 42,387,969 B |

原四项硬预算不调整。前照灯套件的请求窗口包含既有额外DumpTools异步分包，全部计入保守上界；它与标准首屏窗口的差异不算优化收益。新增程序几何并不等于FPS提升，离线字节也不等于加载速度改善。

最终包相对基线，静态初始/实际首屏JS均增加14,400 B、完整发布增加18,528 B。全部36运行素材摘要保持；[环境记录](environment.json)保留Node24.21.0、Babylon9.30.0、TypeScript5.9.3、Webpack5.111.1、Playwright1.64.1及工具边界。

## 诊断、限制及复跑

- 初版机房门角挤占5.5m绕塔检查的肩部净空，向塔后移0.4m后原检查通过；没有放宽碰撞或跳过断言。机房常开门洞、站位、天棚、车辆禁入及共享实体均有用例。
- 备用灯最初在屋檐近侧，改为高位外伸支架；射线同时检查屋檐、支架、底座与帽沿，最终站位可见实际透镜。[旧包诊断](diagnostic-before-eave.json)只保留旧结果来源，不能计入最终通过项。
- 首轮GPU差异虽能检测设备轮廓，目视仍发现PV正反面绕序颠倒；修正受光面朝上/朝南，加入法线断言并重建、重跑全部套件。[旧包记录](diagnostic-pv-winding.json)保留原包/套件摘要，不能以其通过标记替代最终画面；旧包截图由最终复跑覆盖。
- 最终路线首次复跑在取消擦拭前发现盐膜已清除：[失败记录](diagnostic-journey-capture.json)/[日志](diagnostic-journey-capture.log)保留4次上爬和已通过的一圈观察，未计作完整路线。原截图循环持续用50ms步长推进设备，截图本身可能完成剩余擦拭；适配器改为仅截图期间临时使用0增量，完成后恢复原计时，再用原输入和原断言复跑同一生产包。未更改产品清洁条件、缩短验收路线或放宽取消断言。
- 本机沙盒禁止监听端口，随后按工具权限校验启动仅绑定127.0.0.1的独立dist服务器和临时无头浏览器。未更改自动化安全设置、用户浏览器配置或生产代码。
- 本轮使用Chrome和WebKit；Firefox、Safari、物理设备及主观听感未验，未恢复此前暂停的FPS/GPU耗时/加载速度实验。机房尺度和通风表达是虚构场景设计，不是工程选型或真实通风验收。

复跑先执行`npm test`、`npm run typecheck`、开发临时输出构建及`npm run build:production`。使用`python3 docs/technical-plans/assets/coastal-cliff-d-2026-10-18/serve-dist.py --port 8219`只托管最终dist；设置`PLAYWRIGHT_PACKAGE=/private/tmp/dsh-playwright/node_modules/playwright-core`、`PLAYWRIGHT_WEBKIT_EXECUTABLE=/private/tmp/study-audio-test-browsers/webkit-2336/pw_run.sh`、`STUDY_URL=http://127.0.0.1:8219/`后运行本目录`run-checks.cjs`，再运行`verify-evidence.cjs`。环境路径属于本机已有工具，不是新增应用依赖。另建证据副本，避免覆盖本次记录；新生产包须新建汇总，校验拒绝跨包拼接。
