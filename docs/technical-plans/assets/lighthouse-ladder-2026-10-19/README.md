# 灯塔窗位分层与垂直梯验收

日期：2026-10-19。代码基线为首层`b6116c0`及关联`9019ca1`；当前`8cf7d26`仅增加独立昼夜方案。对应[第二阶段修订方案](../../2026-10-19-lighthouse-vertical-ladder.md)，[原旋梯方案](../../2026-10-18-lighthouse-interior.md)保留为已替代历史。

## 交付结果

首层、二/三/四层和顶层灯室共五站，高度相对住宅为3.54 / 6.39 / 10.99 / 15.09 / 19.64米；三个中层分别对齐原高窗，窗台离楼面0.90米。完整圆形木楼板、贯通矩形梯井和U形保护栏使用共享布局；顶层平台/檐口切同一洞口，东南常开口连通外廊。无旋梯和自动转头。

E/左键抓梯与离梯，W/↑上爬、S/↓下爬；每层自动停稳，松开重按继续；中途松键可停留，离梯只在楼层。抓/离梯短水平平移保留镜头朝向；爬速独立于行走倍率，保留鼠标环顾。地图/设置/ESC/预设暂停保留高度，主动回家退出爬梯。

![剖面与平面](ladder-section.svg)

## 工程与功能

- [tests.log](tests.log)：161项测试通过，包括真实楼板面/净空射线、五层窗位/安全站位、同XY多层、洞口/窗墙/玻璃/外栏和灯具边界、双向停靠/长帧/输入消费、相机朝向与安全离梯、门扇垂直范围及共享资源/销毁。原首层与住宅测试继续通过。
- [typecheck.log](typecheck.log)、[development-build.log](development-build.log)、[production-build.log](production-build.log)：类型、临时开发构建和生产构建/自动发布校验通过。开发输出在`/tmp/babylon-lighthouse-ladder-development`，没有覆盖最终`dist`。
- [browser.json](browser.json) / [check-ladder.cjs](check-ladder.cjs)：Chrome155.0.8059.82，1280×800、DPR1、禁用缓存。未修改生产脚本；通过原调试器断点获取现有Room实例，塔外一次定位之后只用真实W/S/E/点击通行；调整目标仅用于步行/观景朝向，没有后续位置或梯上高度修正。验证闭门阻挡、开门进出、四段上行/四段下行和五层离梯/重抓、三窗观景、外廊32个路点整圈、地图/预设/设置/ESC恢复、梯中离梯拒绝、禁横移/跳跃、0.25/3行走倍率的相同爬速及梯上主动回家。采用50ms参考步长，不能作为行程耗时或FPS测量。
- [engines/matrix.json](engines/matrix.json) / [check-matrix.cjs](check-matrix.cjs)：Chrome155.0.8059.82、WebKit27.2；1280×800、390×844、844×390各DPR1/2，共十二组合；梯井仰视、中层窗口和外廊共36张画面、网格准备、147纹理/16灯/3相机及重复pagehide销毁通过。固定镜头夹具禁用相机输入，HUD脚底状态不作为矩阵断言；正确楼层文字及原位恢复由Chrome真实通行专项验证。
- [regression.json](regression.json) / [check-regression.cjs](check-regression.cjs)：13预设、8抽屉/8灯/7门及推拉门、55段住宅路线、跳跃/边界、地图/信件/设置/Inspector、异步模型失败降级和释放通过。脚本来自既有住宅回归，当前交互总数为26。
- [主卫镜面](mirrors/master/mirror-map.json)与[公卫镜面](mirrors/public/public-mirror.json)：沿用上一阶段脚本`../lighthouse-d-2026-10-18/check-map-mirror.cjs`及`check-public-mirror.cjs`，使用本轮生产URL与独立输出目录。真实反射像素、门控与隐藏恢复通过，记录中的旧baseline表示脚本原始来源。
- [screenshot-qa.json](screenshot-qa.json) / [check-screenshots.py](check-screenshots.py)：36张矩阵图的场景区域非空白检测通过；另外人工检查首层梯子、窗口、WebKit横竖屏和外廊。非空白阈值仅排除空帧，不等于画质评分或性能证据。

所有最终浏览器记录中运行错误和404为零；Chrome专项、住宅回归、子路径和矩阵所捕获控制台警告均为空。WebKit没有作为实际完整键盘攀爬验收，也不替代Safari/物理设备。

## 资源和独立托管

| 指标 | 本轮结果 | 相对首层 |
| --- | ---: | ---: |
| 新楼板/檐口/梯/护栏 | 6合批 / 3,264顶点 | 独立记录，上限6 / 8,000 |
| 全场景 | 661网格 / 567,757顶点 | +4 / +2,202（已扣旧封板等） |
| 材质 / 纹理 / 灯 / 相机 | 92 / 147 / 16 / 3 | 均不变 |
| 原外景部分，已扣新结构 | 154,787顶点 | 旧部分仍低于160,000设计目标 |
| 外景含新结构 / 含载具 | 158,051 / 161,849顶点 | 新室内成本不藏入旧目标 |
| 两个目标GLB | 4,332,840字节（4.13MiB） | 不变，预算4.25MiB |
| 运行素材 | 15,867,631字节（15.13MiB） | 不变，预算16MiB |
| 静态初始JS | 2,650,144字节 | +12,610，预算3MiB |
| 实际首屏JS，含必需异步 | 2,868,996字节（2.74MiB），12个JS | +12,610，预算3MiB |
| 完整发布 | 42,273,039字节（40.31MiB），495文件 | +13,030，预算41MiB |

新增几何均为本项目原创程序建模，复用现有共享材质与海岸照明；无新增下载、材质、纹理、灯、相机、RTT或依赖，不改变36素材的摘要/来源及白名单。移动入口门继续不参与静态缓存阴影，SSAO保留。

[release-check.json](release-check.json) / [check-release.cjs](check-release.cjs)确认只托管最终`dist`；根路径和`/home/`各495文件大小/SHA256通过，不允许public兜底，全部动态分包及说明/许可文件均包含。保留[发布清单](release-manifest.json)与[模块分析](bundle-analysis.json)。[subpath.json](subpath.json)确认子路径实际首屏、地图、回家及按需Inspector的所有JS请求均落在`/home/`。

## 复跑与测量边界

本机通过`../coastal-cliff-d-2026-10-18/serve-dist.py --port 8184 --root <仓库绝对路径>/dist`独立托管。Node脚本使用`PLAYWRIGHT_PACKAGE=/tmp/dsh-playwright/node_modules/playwright-core`和`STUDY_URL=http://127.0.0.1:8184/`；跨引擎额外指定`PLAYWRIGHT_WEBKIT_EXECUTABLE=/tmp/study-audio-test-browsers/webkit-2336/pw_run.sh`。这些是本机工具路径，未进入依赖或发布包。镜面脚本的`STUDY_CHECK_OUTPUT`指向本目录下相应`mirrors`目录，公卫输出目录需预先创建。截图检测使用本机含Pillow的Python。

初次自动化在锁鼠事件尚未完成时发送W，导致只走一步/未爬升；等待事件稳定150ms后，正常通行与恢复通过，没有因此放松安全边界。矩阵准备检查改用实际网格的`isReady(true)`，避免把未进入视野的材质`getEffect()`为空误判为运行故障。截图在渲染循环合成稳定后采集。

未重新跑住宅→步道→灯塔全路段，未验Firefox、Safari、物理移动设备及WebKit完整键盘登塔；横竖屏只代表窗口适配。未测主观眩晕、加载耗时或FPS，暂停性能实验保持暂停，不能从字节/静态画面推出相关收益。第三阶段的精细设备/陈设、独立照明和声音仍待实施。

实现提交：`63e6272`（按窗位设置灯塔五层并改用垂直梯）。后续关联记录提交仅更新文档，不改变已验收的运行代码与发布产物。
