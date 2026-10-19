# 白云与星空第三阶段验收

状态：第三阶段工程与可用平台已完成。输入提交`47eb076`，运行实现沿用`coastal-clouds-stars-v2`；本阶段交付完整回归、可复跑脚本和生产证据，最终495个发布文件与第二阶段逐字节一致。

范围为完整自动/暂停、原交互与全路线、生命周期、可用浏览器矩阵及生产发布交付。固定时步和参考画面用于功能检查，FPS/GPU/加载耗时实验保持暂停。前两阶段历史证据保留；受限平台单列未验。

详细目标与顺序见[技术方案第12节](../../2026-10-19-coastal-clouds-and-stars.md#12-第三阶段实施记录)。

## 工程与证据版本

[187项测试](tests.log)、[类型检查](typecheck.log)、[临时开发构建](development-build.log)、[生产构建](production-build.log)及[发布校验](release-verification.log)通过。开发输出位于临时目录，浏览器仅访问最终`dist`。Webpack保留3条既有性能建议。Chrome控制套件打开Inspector时记录1条`slider-vertical`弃用提示，定位至Fluent UI `@fluentui/react-slider@9.6.6`的兼容分支；来源与摘要见实现清单，最终核对只允许该套件这条精确提示，其他套件告警为空。故障注入的预期网络错误单独记录。

[执行器](run-checks.cjs)完成18个浏览器/发布套件与1个平台探测，均绑定同一生产清单摘要，见[执行记录](run-checks.json)。[实现清单](implementation.json)固定115个运行源码/测试/配置及必要夹具文件摘要，[来源记录](suite-sources.json)保留9个派生脚本的历史来源，复用脚本的结果`baseline`仅表示套件起源，本轮实际版本以执行记录和生产清单为准。[证据核对脚本](verify-evidence.cjs)、[机器汇总](acceptance-summary.json)与[核对日志](evidence-verification.log)确认最终状态；初次汇总对Inspector提示作了零告警假设，[失败日志](evidence-initial-warning.log)保留，核实依赖来源后按精确提示登记。

## 自动循环、暂停与手动过渡

[云星完整循环](automatic-clouds.json)及[脚本](check-automatic-clouds.cjs)：Chrome155.0.8059.82、WebKit27.2各通过14,400个100ms生产回调，模拟完整24分钟时钟周期；覆盖18→21→00→03→06并返回18点。每6步保存一次共享云色/显星状态，另保存阈值附近状态，各2,414组；云色与显星权重符合连续求值，天空/海面同值，停止在10Hz批次之间也精确补齐。

两引擎分别在太阳高度−4°/−12°两侧及跨午夜采样15个GPU参考帧，共30帧、20个相邻比较；所有同状态重复差异为0。相隔6秒场景时间的相邻帧平均最大差0.479628/255、单通道最大10/255，差值超过8/255的像素最多占0.004493%。这是有限视角/固定时步的画面证据。

初次新增脚本把上述6秒场景间隔按近静止帧设为均差0.2、峰值6，实际入夜正常渐变均差0.479628、少量星点峰值10触发失败。保留[首次失败](automatic-initial-failure.json)、[完整诊断](automatic-complete-diagnostic.json)及[判定修正记录](automatic-diagnostic-notes.json)：最终同时要求参数按解析轨迹连续、静止重复差异0、平均差<1/255、峰值≤16/255及大于8/255的像素占比<0.1%，分别检查整体变化与稀疏星点/既有8位后期量化。运行实现、发布包和资源预算保持；这些失败记录不计通过。

[时间与控制](controls.json)通过八节点、25个50ms手动参考帧、中途改选、10Hz批次、完整旧时钟回归、失焦/隐藏/长帧/重叠暂停、地图/详情/Inspector、步行和骑乘暂停、0.2秒减少动态效果及重复释放。菜单关闭后按应用规则点击场景恢复指针，先前按住的移动键不会自动续走。

| 自动循环画面 | Chrome | WebKit |
| --- | --- | --- |
| 入夜阈值 | [19:16](chromium-automatic-00765.jpg) | [19:16](webkit-automatic-00765.jpg) |
| 午夜 | [00:00](chromium-automatic-03600.jpg) | [00:00](webkit-automatic-03600.jpg) |
| 清晨 | [06:00](chromium-automatic-07200.jpg) | [06:00](webkit-automatic-07200.jpg) |
| 完整周期回到黄昏 | [18:00](chromium-automatic-14400.jpg) | [18:00](webkit-automatic-14400.jpg) |

## 路线、原交互与生命周期

[午夜全路线](journey.json)仅在住宅门内使用一次初始位置夹具，此后通过实际W/S/E/鼠标输入连续行走：去程139路点、灯塔五层逐层上下/离梯、外廊32点环行、回程139路点并走回客厅；覆盖塔门阻挡、梯中禁止离梯、地图/时间/设置/预设/解锁恢复。途中没有位置或梯高纠正。[塔门](entrance-open.jpg)、[梯中地图](ladder-mid-map.jpg)、[顶层外廊](gallery-view.jpg)保存实际午夜画面。

[生命周期](lifecycle.json)验证模型在手动过渡期间晚到，继承当前室内照明且云星仍同步；阻断室外HDR后00/12/06/21节点保持回退并成功编译天空/海面，预期网络错误独立登记。梯上时间菜单暂停保留姿态，重复释放后观察者和网格归零。

[三轮应用重建](recreate.json)检查真实document/window/时间按钮监听不累积，各轮默认正午，再通过菜单切午夜、自动推进和重复销毁。固定朝向的云星像素SHA256三轮均为`6661ffce8822d96429076caec6872e4d5916c6dcb7bed7b7f229856f1b1dd7b9`；每轮资源相同，释放后网格/材质/纹理/灯/相机/观察者/引擎场景全部为0。

[小电驴](browser.json)通过六位置40km/h巡航与加速、三处碰撞、制动/倒车、地图暂停/安全下车和Inspector；[跳跃](jump/jump.json)通过六种家具/地面落点、原地起跳、走下床及轨道视角忽略空格。车辆/跳跃使用同步位置和固定时步夹具，不扩为完整驾驶实测或性能结果。[子路径浏览器](subpath.json)通过时间菜单、自动开关、地图回家/指针恢复、Inspector真实动态加载，所有JS请求保持`/home/`前缀。

## 浏览器矩阵与画面回归

[响应式与自动流转矩阵](engines/matrix.json)通过Chrome/WebKit×1280×800、390×844、844×390×DPR1/2共12组，96节点及36自动段；检查键鼠/触控、44px最小选项、滚动/焦点/面板边界、暂停和共享云星参数。正常浏览器运行/着色器错误、告警和404均为0。

高DPR测试显式在夹具中设`hardwareScalingLevel = 1 / devicePixelRatio`并调整缓冲，应用默认CSS尺寸缓冲策略保持。真实缓冲尺寸另由星点稳定性结果记录，不能仅以浏览器DPR标签充当双倍分辨率证据。

[八节点六视角](visuals.json)归档48图，含阳台、次卧、房外、途中步道、塔前和小电驴；日月光盘、晨昏交接及32个阴影/位置锚点通过。[反射对照](reflection.json)复核共用方向云场、粗糙度/像素足迹低通、纯净海雾及无重复光盘，四方与天顶40图在本目录另存。实际海面云色对照变化且恢复一致，当前粗糙水面的星光贡献保持完全过滤。

每组星点另录13个慢转/视场缩放参考帧，共156帧，见[世界方向与通量](stability.json)。相邻帧匹配率最低97.826%，最大角误差0.00083431弧度；角面积归一化通量比0.6541～1.5461，六组DPR对照的共有星点匹配率均100%。DPR2实际缓冲为2560×1600、780×1688、1688×780，资源数在96次节点切换后保持。固定步长画面与方向/通量检查不代表实机录像或帧率测量。

[海面与镜面](mirror-clouds.json)复核主卫实际窗洞7,752个云像素变化、恢复差异0；公卫闭门墙体差异0，开门仍按几何遮挡。该主卫夜窗姿态检出星点0，未记为某颗镜中星点对齐的正样本。[主卫物体/门灯/缓存](mirrors/master/mirror-map.json)与[公卫门灯/视角](mirrors/public/public-mirror.json)通过，两张512²目标、局部所有权与可见刷新门控保持。实际海面云对照61,957像素变化、恢复差异0，星光开/关差异0；粗糙水面继续消去星光频带，海雾保持纯渐变。

[手动云星过渡](transitions/transitions.json)重新通过25个50ms参考帧、3次中途改选及0.2秒减少动态效果，云色/星权重在天空与海面同值；[原住宅回归](regression.json)通过8抽屉/8灯/7门、八房55段碰撞路线、推拉门保护、详情/地图/拖动缩放/设置/Inspector、模型失败隔离与释放。重复旧交互截图仅保留在`/private/tmp/babylon-clouds-stars-phase3-regression`，本目录保存本轮结果及执行日志。

## 生产发布与预算

[发布检查](release-check.json)在只托管最终`dist`的服务上，对根路径和`/home/`各495文件GET、字节和SHA256核对通过，包含全部动态Inspector/编辑器分包、说明、分析报告与清单自身。[生产清单](release-manifest.json)SHA256为`98ebc67673638081c00339224314efc7bf1dcfc0a8e2387ba0272577829ed481`，与第二阶段相同；[分包分析](bundle-analysis.json)和36个运行素材/两目标GLB摘要均保持。

| 指标 | 本阶段实测 | 原预算 |
| --- | ---: | ---: |
| 两目标GLB | 4,332,840 B | ≤4.25 MiB |
| 运行素材 / 文件 | 15,867,377 B / 36 | ≤16 MiB |
| 静态初始JS | 2,684,677 B | ≤3 MiB |
| 实际首屏含必需异步JS | 2,903,529 B / 12文件 | ≤3 MiB |
| 完整发布含清单 | 42,316,300 B / 495文件 | ≤41 MiB |
| 网格 / 顶点 | 670 / 570,475 | 无新增 |
| 材质 / 纹理 / 灯 / 相机 | 95 / 148 / 17 / 3 | 无新增 |

相对第二阶段所有发布字节增量为0；相对白云星空实施前，静态/实际首屏累计+6,443 B、完整发布累计+6,444 B，仍满足24/64KiB规划增量目标。未更改阈值、白名单、导入/注册、依赖、材质/灯光或用户画质设置；证据文件不进入发布目录。没有额外测绘制次数、GPU/FPS或加载耗时。

## 画面索引

下表是本轮重新生成的六视角；每时段另有`north/east/south/west/zenith`五方向仰望。

| 时间 | 阳台 | 次卧 | 房外 | 步道 | 塔前 | 小电驴 |
| --- | --- | --- | --- | --- | --- | --- |
| 00 | [图](00-balcony.jpg) | [图](00-bedroom.jpg) | [图](00-house.jpg) | [图](00-path.jpg) | [图](00-tower.jpg) | [图](00-scooter.jpg) |
| 03 | [图](03-balcony.jpg) | [图](03-bedroom.jpg) | [图](03-house.jpg) | [图](03-path.jpg) | [图](03-tower.jpg) | [图](03-scooter.jpg) |
| 06 | [图](06-balcony.jpg) | [图](06-bedroom.jpg) | [图](06-house.jpg) | [图](06-path.jpg) | [图](06-tower.jpg) | [图](06-scooter.jpg) |
| 09 | [图](09-balcony.jpg) | [图](09-bedroom.jpg) | [图](09-house.jpg) | [图](09-path.jpg) | [图](09-tower.jpg) | [图](09-scooter.jpg) |
| 12 | [图](12-balcony.jpg) | [图](12-bedroom.jpg) | [图](12-house.jpg) | [图](12-path.jpg) | [图](12-tower.jpg) | [图](12-scooter.jpg) |
| 15 | [图](15-balcony.jpg) | [图](15-bedroom.jpg) | [图](15-house.jpg) | [图](15-path.jpg) | [图](15-tower.jpg) | [图](15-scooter.jpg) |
| 18 | [图](18-balcony.jpg) | [图](18-bedroom.jpg) | [图](18-house.jpg) | [图](18-path.jpg) | [图](18-tower.jpg) | [图](18-scooter.jpg) |
| 21 | [图](21-balcony.jpg) | [图](21-bedroom.jpg) | [图](21-house.jpg) | [图](21-path.jpg) | [图](21-tower.jpg) | [图](21-scooter.jpg) |

## 复跑与未验边界

在对应提交、锁定依赖和可用浏览器上执行`npm test`、`npm run typecheck`、`npm run build -- --output-path /private/tmp/babylon-clouds-stars-phase3-dev`、`npm run build:production`和`npm run verify:release`。用[独立托管脚本](../coastal-cliff-d-2026-10-18/serve-dist.py)仅托管`dist`，本轮端口8201。

本机验收工具变量为`PLAYWRIGHT_PACKAGE=/private/tmp/dsh-playwright/node_modules/playwright-core`、`PLAYWRIGHT_WEBKIT_EXECUTABLE=/private/tmp/study-audio-test-browsers/webkit-2336/pw_run.sh`、`PLAYWRIGHT_FIREFOX_EXECUTABLE=/private/tmp/study-audio-test-browsers/firefox-1538/firefox/Nightly.app/Contents/MacOS/firefox`和`STUDY_URL=http://127.0.0.1:8201/`。运行本目录`run-checks.cjs`，可带套件名称仅复跑受影响项；随后执行`verify-evidence.cjs`。源码、工具、包或浏览器变化后应另建记录，不覆盖本阶段历史。日志只清理行尾空白。

Firefox启动与Safari会话探测均15秒超时，见[平台探测](platform-availability.json)，没有调整用户安全设置；物理设备与主观听感未验。WebGL2结果不扩为WebGL1，暂停的FPS/GPU/加载耗时实验继续暂停。原中性IBL、局部阴影、固定云形/星位及美术粗糙过滤近似保留；本阶段没有待开发项。提交入口：`git log --follow -- docs/technical-plans/assets/clouds-stars-phase3-2026-10-19/README.md`，提交目的“完成白云星空第三阶段整体验收与交付”。
