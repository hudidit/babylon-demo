# 设备现场工作台验收

日期：2026-10-22。输入：`67c33ff`。对应[技术方案](../../2026-10-22-device-ui-workbench.md)。本次重做设备展示和导航，原场景权限、六组命令、真实计时及存档协议保持。

## 设计与画面

- 改造前：[首层仪表](before/control-desktop.png)、[灯座试灯](before/test-desktop.png)、[保护面](before/cover-desktop.png)、[记录夹](before/records-desktop.png)、[手机](before/control-mobile.png)；[截图基线与清单绑定](before/capture.json)。这些是上一回合当前生产包截图，原样复制，无图像修改。
- 新版：[首层现场](device-control-1280.jpg)、[试灯中](device-test-running-1280.jpg)、[保护面待清洁](device-cover-dirty-1280.jpg)、[等待独立复查](device-cover-recheck-1280.jpg)、[全站记录](device-records-1280.jpg)、[保存页](device-saved-1280.jpg)。
- [手机](device-control-390.jpg)、[320px窄屏](device-control-320.jpg)、[短横屏](device-control-844.jpg)、[太阳能手机页](device-solar-array-390.jpg)、[手机记录](device-records-390.jpg)。内页可滚动，页头、导航、返回和页脚保持固定；桌面把仪表和操作并列，保存不再挤在仪表下方。
- [太阳能巡视/对照](device-solar-inspected-1280.jpg)、[风雨操作限制](device-solar-storm-1280.jpg)、[保存失败](device-save-failed-1280.jpg)、[不可用存档](device-save-invalid-1280.jpg)、[空记录](device-records-empty-1280.jpg)。内容读取真实游戏状态，不使用示意值或假完成状态。
- [擦拭实际进度](device-cleaning-progress.jpg)、[观察半圈](device-observation-half.jpg)、[观察完成](device-observation-complete.jpg)。环形进度仍由原共享时钟与实际视线驱动，不用CSS计时。

应用已安装的game-ui-ux与frontend-design，固定版本/许可/已读文件摘要见[技能来源](../game-ui-journal-2026-10-22/skill-sources.json)。海墨/雾纸/黄铜沿用值守簿，原创设备线描、SVG刻度和HTML仪表名称由本项目创建；没有导入外部脚本、图片、字体或UI依赖。截图复核将仪表名称移出SVG，使手机上维持15px；Esc提示按当前页面显示，隐藏/禁用动作和错误清除后接续可用焦点；手机长记录改为上排时间/项目、下排完整结果。

## 验证

- [366项测试](tests.log)、[类型检查](typecheck.log)、[开发构建](build-development.log)、[生产构建与发布校验](build-production.log)。原3项webpack体积建议保留。
- [设备脚本](check-devices.cjs)/[设备结果](devices-browser.json)：本机只托管最终dist，八类设备及四处原设备入口使用实际距离/视线和原生按钮；位置为当地夹具，活跃时间为原共享时钟有界回调，不制造工作证据、电量或故障。
- 覆盖四尺寸边界/内页与页脚、44px按钮、页签/Tab/Home/End/Esc、页面导航不改变游戏状态、隐藏/禁用焦点接续、减少动态效果；实际读表、清洁中断/重做/独立复查、主灯29.9秒未完成与30秒一圈/出光完成、观察移开重置/地图暂停、太阳能2秒巡视/5秒细查/天气对照及风雨限制。
- 记录夹清单、当地设备筛选、空/多页记录、正常存读、配额失败保留、损坏/未知存档不覆盖及明确清除；继续先暂停、清除后焦点返回保存按钮、记录夹的两级返回通过。
- [故事第一章脚本](check-story.cjs)/[结果](story-browser.json)：从信件到三项真实设备取证、报告/岸站确认、故事保存/继续和失败保护，根/子路径运行；[原场景脚本](check-regression.cjs)/[结果](regression.json)回归三尺寸远景、探索/地图/设置、灯具、正常存读、Inspector和释放。
- 根路径及`/home/`各495文件GET/长度/SHA256，包含全部动态分包；36运行素材摘要与上一UI基线相同。浏览器/源码/清单及文档链接、模型不变和截图摘要由[证据检查](check-evidence.cjs)/[结果](documentation-check.json)核对。

设备12类功能、19项布局及两套场景回归均以最后发布清单绑定，错误/告警情况见相应JSON。设备与故事无错误/告警，原Inspector保留1条Chrome样式弃用提示。原生设备保存页的故事保存/继续也已通过。

| 指标 | 输入67c33ff | 本次 | 原预算 |
| --- | ---: | ---: | ---: |
| 两目标GLB | 4,332,840 B | 4,332,840 B | 4.25 MiB |
| 36运行素材 | 15,867,377 B | 15,867,377 B | 16 MiB |
| 静态初始JS | 2,906,556 B | 2,911,135 B | 3 MiB |
| 实际首屏JS（含必需异步） | 3,125,408 B | 3,129,987 B | 3 MiB |
| 完整发布（全部分包/说明/清单） | 42,596,508 B | 42,608,339 B | 41 MiB |

实际首屏增加4,579 B、余15,741 B；完整发布增加11,831 B、余383,277 B。最终清单SHA256：`fd141e8e5902ebb24db30246431d0daaafb90c4114d8259aa51bf24f406e873f`。未改预算与白名单，无新下载或运行依赖。

浏览器验收为Chrome桌面引擎及四种CSS视口；未声明实机触摸、手柄、屏幕阅读器、其他浏览器、多日剧情或完整徒步验收。本次没有FPS/加载耗时实验，图片与字节不构成速度收益证据。原Inspector样式弃用提示按实际结果保留。

## 复现

依次运行`npm test`、`npm run typecheck`、`npm run build`、`npm run build:production`；再运行本目录`check-devices.cjs`、`check-story.cjs`、`check-regression.cjs`及`check-evidence.cjs`。浏览器使用Chrome，Playwright Core默认路径为本次临时环境`/private/tmp/dsh-playwright/node_modules/playwright-core`，可用`PLAYWRIGHT_PACKAGE`指定安装位置。
