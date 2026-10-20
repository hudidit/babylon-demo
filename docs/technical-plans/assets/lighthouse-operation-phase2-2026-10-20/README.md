# 灯塔子项目一第二阶段验收

日期：2026-10-20。代码基线`31f88dc`，范围见[详细方案](../../2026-10-20-lighthouse-project-01-core-loop.md)“二 灯头与基本面板”。第二阶段工程/可用浏览器验收已完成；三/四阶段待实施。代码、方案与本目录在同一实施提交留档，提交标识以Git历史追踪。

## 实现与玩家操作

- [LighthouseBeacon](../../../../src/examples/LighthouseBeacon.ts)将原静态中央透镜、九圈玻璃及四道金属环独立为光学头，增加单侧发光面和不对称机件；外层八面玻璃、保护框、底座及建筑固定。所有旋转顶点位于原半径0.44米保护区内，原碰撞、梯井和外廊保持。移动网格从缓存静态阴影名单中排除，没有增加或逐帧刷新阴影图。
- 转台只读取第一阶段`LighthouseOperation`的相位与实际灯态，10活跃秒一圈。发光面使用原创GLSL，观察方向在正面6°～12°内平滑出现单束白闪，背向没有第二束；每次绘制使用实际主/反射观察点。近景保持真实尺寸，远处有效出光方向补足最小3个渲染像素宽，以免低分辨率漏采样。仍使用实体深度、裁切和现有后期；不是体积光柱、地面扫光或已标定航海射程。
- [LighthouseDetails](../../../../src/examples/LighthouseDetails.ts)将首层既有面板及旋钮拆成独立拾取对象，原工作灯开关继续只控制工作照明；顶层灯座南侧设置固定`TEST`控制面。稳定交互标识为`lighthouse-control-panel`与`lighthouse-beacon-main`。
- [LighthousePanel](../../../../src/examples/LighthousePanel.ts)显示中文实际模式、灯态、值守日/时刻、18点至6点日程、单束10秒灯质、试灯余时和最近5条客观运行事件。首层只读并指示灯座入口；顶层开始/结束试灯后返回观察。夜间结束或到期仍保持正常导航；标明稳定供电、备用灯/电池监测尚未接入，没有虚构电量和全面正常声明。
- [RoomInteractions](../../../../src/examples/RoomInteractions.ts)与[RoomScene](../../../../src/examples/Room.ts)在打开及命令执行时复核第一人称、落地、对应楼层、1.5米内最近命中/无遮挡，拒绝爬梯、车辆、跳跃和远景操作。首层验收站位为塔心相对`(-1.8,-0.95)`，顶层为`(0.25,-1.1)`米，两处均经原行走与抓梯规则验证；保留E/左键抓梯优先。
- 新增独立`lighthouse-panel`共享暂停原因，面板内设备、日历和过渡冻结，返回按钮恢复指针，ESC保持原位并等点击场景恢复；Tab/Shift+Tab在可用按钮间循环。时间/设置/地图互斥沿用原机制，其他暂停拥有者未解除时不能执行设备命令。DOM监听使用AbortController随场景释放。
- [记录图集](../../../../src/examples/LighthouseRecords.ts)保留原1024×512尺寸/字形生成与记录夹查看，去掉永久日间待机和未经实际检查的完成语句；改为查阅面板/检查提示，在空白图集区加`TEST`。三项巡检、盐膜/清洁和完整动态任务日志仍在第三阶段。

## 工程检查与迭代记录

[223项测试](tests.log)、[类型检查](typecheck.log)、[开发构建](development-build.log)、[生产构建及自动发布校验](production-build.log)通过。新增[8项设备测试](../../../../tests/lighthouse-beacon.test.cjs)覆盖单向周期/背向、独立旋转/保护范围、静态阴影排除、工作灯独立、真实可达站位/遮挡/楼层限制、暂停、记录语义及资源释放；原独立进程pure注册探针保持通过。开发输出在`/private/tmp/babylon-lighthouse-operation-phase2-development`，生产目录未被开发包覆盖；Webpack保留3条既有体积/入口/运行时代码建议。

开发中修正和复验了以下问题：

- 旋钮挡住面板中心射线：独立旋钮批次并纳入同一设备的可拾取表面；发光面补足法线，以满足原几何/拾取约定。
- 初始顶层夹具靠近抓梯优先区：改用经原行走/抓梯规则确认的东南侧站位，未改变抓梯规则。原生对话框末尾Tab会移往浏览器界面，补充局部焦点循环；异步指针锁定检查保留150毫秒稳定窗口，未改变设备计时。
- GPU像素读取必须在绘制当次任务内进行，避免默认绘图缓冲被浏览器丢弃产生零读数；矩阵及返程采样已使用即时绘制/读取。参考时步只用于功能验收，不是FPS或旅行耗时测量。
- [未补偿的横屏候选](landscape-before.json)中，844×390/DPR1远处峰值约32.640、背向约32.674，实际信号漏采样；加入上述最小像素补偿后复验。候选文件明确含失败，不能当作交付通过记录。

## 最终生产浏览器证据

下列结果均基于最终同一生产目录，发布数据为42,346,870字节/495文件。没有改写交付bundle或增加测试全局；Chrome由既有CDP夹具捕获实例，跨引擎夹具读取原引擎。手动设置相机/状态的组件夹具与连续真实行走分别说明，不将夹具当作真实旅行。

- [根路径](browser.json)和[子路径](subpath/browser.json)：Chrome155.0.8059.85、1280×800/DPR1、禁用缓存及音频就绪后，实际点击首层面板/顶层试灯、ESC/返回/Tab循环、开界面冻结、其他暂停未解除/移出合法位置拒绝旧命令、夜间测试30秒到期不中断导航、工作灯独立及释放通过。中文面板另测390×844和844×390，无横向溢出、按钮可键盘/滚动触达。近景实际模型10秒序列的中心ROI亮度约15.043～198.617；[面板桌面](ground-panel.jpg)、[竖屏](test-panel-390.jpg)、[横屏](test-panel-844.jpg)、[夜间读数](night-panel.jpg)已目视检查。视角位置是专项夹具，完整路线见下一条。
- [连续路线](journey/journey.json)与[路线日志](journey.log)：复用并扩展旧全程脚本，只有住宅入口一个初始姿态夹具，之后通过真实W/S/E/点击、相机朝向和原控制更新连续前进，无位置或梯高纠正。住宅至塔外/返程各139个路点，4次上/4次下覆盖五层、外廊32段、地图/设置/ESC保高、首层实际面板及顶层开始试灯/观察完整10秒/主动结束均通过，最后实际回到客厅。返程近宅`(-5.429,-3.469)`处以真实时间菜单切到21点观察一整圈，8×8中心ROI约27.692～50.007；[近宅亮闪](journey/house-visible-whiteflash.jpg)、[顶层周期后](journey/journey-optic-after-cycle.jpg)已查看。
- [双引擎矩阵](engines/matrix.json)与[矩阵日志](matrix.log)：Chrome155.0.8059.85/WebKit27.2 × DPR1/2 ×1280×800/390×844/844×390，12组平台/视口/DPR、24个近远景对比全部通过。真实菜单先切21点，再仅为GPU参考帧暂停Room设备更新，固定真实光学头变换/发光方向，对比峰值与背向；不从这些夹具推断业务时钟或FPS。所有发光材质就绪，最小近景ROI增量约171.307、最小近宅增量约1.193（0～255亮度单位）；修复后横屏DPR1峰值约38.416、背向32.674。[Chrome横屏](engines/chromium-landscape-house-dpr1.jpg)、[WebKit横屏](engines/webkit-landscape-house-dpr1.jpg)及[WebKit近景DPR2](engines/webkit-desktop-near-dpr2.jpg)已目视检查。
- [原住宅回归](regression/regression.json)和[回归日志](regression.log)：8抽屉/8原灯/7门、55段全屋通路、13预设视角、信件/地图/指针锁定/拖动缩放/设置/Inspector、书架异步失败隔离和释放通过。适配器只更新当前40个交互标识及8个车辆网格的既有断言，历史套件和证据没有改写；原JSON的`baseline`/`suiteOrigin`保留旧套件来源，本次实际基线为`31f88dc`加本阶段代码。故障页的主动书架请求中止单列于`failurePath`，不混入正常请求统计。

正常根/子路径、连续路线、原回归和24个GPU组合均无页面/控制台错误、警告或404。WebKit默认路径缺少当前Playwright所期待的运行包，实际复验使用本机已有`webkit-2336/pw_run.sh`（报告版本27.2），独立启动/页面就绪探测通过。一次并行批次在第二Chrome上下文等待初始场景超时，未据此归因WebKit或调整产品；其他浏览器验收结束后串行执行完整矩阵通过。未复跑Firefox/Safari或物理设备。

## 资源与发布

与[第一阶段实测](../lighthouse-operation-phase1-2026-10-20/README.md)相比，场景685→691网格、575,062→575,166顶点、100→101材质；152纹理、22灯、3相机及渲染目标保持。光学头自身为4网格/1,792顶点，主要由原几何迁移；净新增6网格、104顶点、1材质，满足原≤12网格/≤8,000顶点/≤3材质目标。没有下载、引擎总入口、新依赖、相机、灯、RTT或阴影图；旋转与发光存在运行更新成本，本轮未开展性能实验。

原创代码/程序几何、发光参数和图集修改已登记[发布来源说明](../../../../public/STUDY_ASSET_SOURCES.md)及[机器可读来源](../../../../public/environment/coastal-cliff-source.json)。36运行素材的字节/摘要保持，两个来源说明随发布更新。

[发布记录](release.json)由[独立校验脚本](check-release.cjs)校验最终目录及根/`/home/`各495文件GET、原始字节与SHA256，包含未触发的调试/编辑器动态分包、来源/许可和清单自身；[完整清单](release-manifest.json)与[依赖分析](bundle-analysis.json)留档。

| 指标 | 第一阶段 | 第二阶段 | 变化 |
| --- | ---: | ---: | ---: |
| 两目标GLB | 4,332,840 B | 4,332,840 B | 0 |
| 36运行素材 | 15,867,377 B | 15,867,377 B | 0 |
| 静态初始JS | 2,696,818 B | 2,707,991 B | +11,173 B |
| 实际首屏JS，含必需异步/音频预热 | 2,915,670 B | 2,926,843 B | +11,173 B |
| 完整发布，495文件 | 42,328,805 B | 42,346,870 B | +18,065 B |

两GLB≤4.25MiB、运行素材≤16MiB、静态/实际首屏JS≤3MiB及完整发布≤41MiB全部保持。完整目录增量包括HTML、着色器/界面代码、来源说明及分析/清单，没有把它们排除来满足预算。

## 复跑

先执行`npm test`、`npm run typecheck`、`npm run build -- --output-path /private/tmp/babylon-lighthouse-operation-phase2-development`、`npm run build:production`。使用`python3 docs/technical-plans/assets/coastal-cliff-d-2026-10-18/serve-dist.py --port 8215`仅托管最终dist。

设置`PLAYWRIGHT_PACKAGE=/private/tmp/dsh-playwright/node_modules/playwright-core`和`STUDY_URL=http://127.0.0.1:8215/`，依次执行本目录`check-browser.cjs`、`check-journey.cjs`、`check-regression.cjs`、`check-matrix.cjs`和`check-release.cjs`；矩阵另设`PLAYWRIGHT_WEBKIT_EXECUTABLE=/private/tmp/study-audio-test-browsers/webkit-2336/pw_run.sh`，串行复验以减少并发干扰。子路径用`STUDY_URL=http://127.0.0.1:8215/home/`及独立`STUDY_CHECK_OUTPUT`执行`check-browser.cjs`。上述路径为本机工具，不是应用新依赖；其他机器应指定已有工具路径。历史复跑应另建输出目录并保留本次基线/候选/交付证据。

## 后续边界

第三阶段才实现三项检查、连续有效观察、盐膜清洁和逐日任务记录，第四阶段做完整子项目的最终综合验收；第二阶段的设备循环/路线证据不把后续任务标为交付。未新增主备/电池/天气、海面或住宅扫光、体积光柱、射程标定或跨会话保存。未开展FPS/GPU耗时/加载速度、物理设备或现实航海功能实验。
