# 灯站值守簿UI验收

日期：2026-10-22。输入基线：`e5fbf0b`。对应[技术方案](../../2026-10-22-game-ui-field-journal.md)。本轮只重做故事展示、导航与任务HUD，原任务/设备判定及存档协议保持。

## 设计来源与比较

- 已安装并应用[game-ui-ux](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/38a4c2500eeb5ff9ac084336b8f66108069d2f8d/skills/disciplines/game-ui-ux)与[frontend-design](https://github.com/anthropics/skills/tree/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/frontend-design)；[固定版本/许可/已读文件摘要](skill-sources.json)。采用游戏页面流程、焦点/返回、安全区和题材视觉/截图复核方法；未运行外部技能脚本，未导入UI包或美术素材。
- [上一版单页](../lighthouse-story-step2-2026-10-22/chapter-one-1280.jpg)与[新版任务页](chapter-one-1280.jpg)：开始/任务/长信/消息/存档分为清晰页面；海墨导航、雾纸阅读区、黄铜主行动与宋楷字体回退服务孤岛题材。
- [故事封面](cover-1280.jpg)、[交接信](letter-1280.jpg)、[岸站待回复](radio-pending-1280.jpg)、[联络原文](radio-reply-1280.jpg)、[保存页](saved-1280.jpg)、[第一章完成](chapter-complete.jpg)。原创线描/图标是内联SVG，未新增下载图片或字体。
- [手机封面](cover-390.jpg)、[手机任务页](chapter-one-390.jpg)、[手机联络](radio-reply-390.jpg)、[短横屏](chapter-one-844.jpg)。截图等待打开动画完成；信件及长页在内页滚动，页头/返回/页脚保持可达。

截图复核修正了短横屏内页撑过页脚、任务HUD遮挡时间菜单关闭按钮、手机当前联络位于横向列表可视区外三个问题。截图只作为画面及布局依据，不用于FPS或加载耗时结论。

## 功能与发布验证

- [366项测试](tests.log)、[类型检查](typecheck.log)、[开发构建](build-development.log)、[生产构建和发布校验](build-production.log)。保留原3项webpack体积建议，原预算、精确导入和全量分包交付保持。
- [第一章与UI浏览器脚本](check-story.cjs)/[结果](story-browser.json)：最终dist经临时静态服务托管，原生控件与真实设备几何/距离/视线权限；位置为当地夹具，以原共享时钟有界回调推进活跃动作，不制造工作事实或电量，不冒称完整徒步。
- 新故事确认可撤销/Tab环绕、方向键/Home/End页签、普通Tab焦点保持、减少动态效果、三尺寸边界/内页不超过页脚；选择消息不标记已读，手机当前消息可见。首轮读表、清洁中断/重做/独立复查、30秒一圈试灯、当地提交、待回复/未读保存恢复、正式回复阅读和完成通过。
- 加载失败停留存档页；配额拒绝和损坏槽保留、明确清除、探索会话还原、原探索/演练键逐字节保持、继续先暂停通过。故事打开时不允许选时/固定天气，时间菜单关闭按钮可用，HUD恢复。
- [原页面回归脚本](check-regression.cjs)/[结果](regression.json)：三尺寸默认远景、拖动/缩放、探索/返回、地图/设置、主灯30秒旋转/60秒试灯/真实观察、正常值守存读、Inspector及释放。故事流程浏览器错误/告警均为空；Inspector保留原1条`slider-vertical`样式弃用提示。
- 根路径与`/home/`分别校验全部495文件的GET/长度/SHA256及实际首屏；36份运行素材摘要保持。[最终发布清单](release-manifest.json)与两套浏览器记录/当前源码的绑定、文档链接及截图摘要见[检查脚本](check-evidence.cjs)/[检查结果](documentation-check.json)。

| 指标 | 输入e5fbf0b | 本次 | 原预算 |
| --- | ---: | ---: | ---: |
| 两目标GLB | 4,332,840 B | 4,332,840 B | 4.25 MiB |
| 36运行素材 | 15,867,377 B | 15,867,377 B | 16 MiB |
| 静态初始JS | 2,899,549 B | 2,906,556 B | 3 MiB |
| 实际首屏JS（含必需异步） | 3,118,401 B | 3,125,408 B | 3 MiB |
| 完整发布（含全部分包/说明/清单） | 42,571,363 B | 42,596,508 B | 41 MiB |

实际首屏增加7,007 B，余20,320 B；完整发布增加25,145 B，余395,108 B。最终清单SHA256：`f9d1ae0ca510a18874b7592e2b25f190f07d695c4e7c599f8b7eaeff40ecfb5c`。两套浏览器记录均为Chrome155.0.8059.86，根/子路径同包同摘要。

仅Chrome桌面引擎及三种CSS视口验收；未做其他浏览器、手柄、实机触摸、屏幕阅读器或多日完整剧情验收。第二/三章、等待与尾声仍在原后续范围；设备仪表/地图/设置沿用既有界面。

## 复现

先运行`npm test`、`npm run typecheck`、`npm run build`、`npm run build:production`，然后依次运行本目录的`check-story.cjs`、`check-regression.cjs`、`check-evidence.cjs`。浏览器脚本需要Chrome及Playwright Core，默认引用本次临时环境的`/private/tmp/dsh-playwright/node_modules/playwright-core`，可通过`PLAYWRIGHT_PACKAGE`指定实际位置；脚本只托管最终dist。
