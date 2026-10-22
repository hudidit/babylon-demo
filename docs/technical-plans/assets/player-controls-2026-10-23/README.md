# 探索切换、运行面板与原地观察验收

日期：2026-10-23。输入基线：`3dc759d`。本目录对应[ESC往返](../../2026-10-23-escape-view-toggle.md)、[运行面板](../../2026-10-23-lighthouse-control-panel-access.md)和[原地观察](../../2026-10-23-lighthouse-stationary-observation.md)。最终状态与边界以三份方案为准。

- [检查脚本](check-browser.cjs)：仅托管最终 `dist`；原生按键/主键操作，使用局部站位夹具和共享时钟，不伪造锁定、相位、出光、检查或故事事实。使用随Codex环境提供的Playwright，路径可由`PLAYWRIGHT_PACKAGE`覆盖。
- [浏览器原始记录](browser.json)与[摘要](browser.log)：Chrome155、DPR1，根路径完整交互及 `/home/` ESC入口；两个路径各496文件GET/字节/SHA256通过，实际首屏均3,145,717B，包含必需异步JS。无运行错误/404/浏览器告警；未打开Inspector或测试其他引擎/实机。
- [最终清单](release-manifest.json)：36项运行素材不变；两目标GLB4,332,840B、素材15,867,377B、静态初始JS2,926,865B、完整目录42,655,639B，四项预算保持，首屏余量11B。全部动态分包与来源说明交付，不宣称加载/FPS收益。
- 工程日志：[395测试](tests.log)、[类型](typecheck.log)、[开发构建](development.log)、[生产构建及发布校验](production.log)。生产保留三项webpack体积建议。
- 桌面/手机近景：[面板1280](panel-1280.jpg)、[面板390](panel-390.jpg)、[任务引导1280](story-guide-1280.jpg)、[任务引导390](story-guide-390.jpg)、[远景1280](overview-1280.jpg)、[远景390](overview-390.jpg)。手机原有底部操作说明隐藏，任务文字可滚动读取。

复现：`npm test`、`npm run typecheck`、`npm run build`、`npm run build:production` 后，执行 `node docs/technical-plans/assets/player-controls-2026-10-23/check-browser.cjs`。本地HTTP监听和Chrome需运行环境授权。面板关闭后留180ms让浏览器锁定事件结清，再点击恢复环顾，随后才计设备单击；所有12次设备操作均一击打开。白天试灯检查固定眼睛位置/朝向推进30秒共享回调，29.9秒未完成，30秒一圈/见过光后检查与故事清单完成，不等同于30秒墙钟或完整徒步体验。
