# 时间默认开启自动流转验收

日期2026-10-21，输入基线`c770eff`。实现只修改统一时钟默认值和HTML初始复选框/状态；[方案第14节](../../2026-10-19-day-night-cycle.md#14-默认开启自动流转2026-10-21)记录范围，手动选点/主动关闭/暂停与24分钟一天规则保持。

[268项测试](tests.log)、[类型检查](typecheck.log)、[开发构建](development-build.log)、[生产构建/自动发布检查](production-build.log)通过。生产构建保留3条既有webpack体积建议，预算不变。

[浏览器脚本](check-browser.cjs)和[原始结果](browser.json)使用最终生产dist，Chrome155.0.8059.85、1280×800/DPR1，根及`/home/`路径分别验证：

- 首次未触碰自动开关，真实渲染循环使小时、灯塔时钟和主电池太阳能储能增长，菜单复选框默认选中。
- 真实时间菜单、设置及地图操作冻结时钟/能量，关闭后继续；窗口blur/focus用合成事件验证，恢复首帧的大delta不补算。
- 主动关闭后保持停止；手动选21点保持原自动关闭规则；再次开启后夜间导航运行、工时增加且电池减少。
- 关闭自动后刷新，新会话回到正午起点并默认开启，继续实际推进。无故障/能量/日历/巡检证据赋值，无新增计时器。
- 无运行错误、404或浏览器警告；根/子路径各495个文件GET、长度及SHA256通过，36运行素材与基线逐项不变。

[发布摘要](release-summary.json)保存最终清单摘要和变动文件：两个GLB4,332,840 B、运行素材15,867,377 B、静态初始JS2,783,636 B、实际首屏含必需异步JS3,002,488 B（两路径一致）、完整发布42,443,669 B。仅HTML增加11 B，JS大小保持，原四项预算通过；没有FPS或加载耗时结论。[复核摘要](verification.json)绑定源码、脚本、结果和日志。

[默认选中画面](menu-default.jpg)、[子路径画面](menu-subpath.jpg)。本轮未重验其他浏览器/实机、完整路线及多日压力，不把旧矩阵算成本轮测试。Node24.21.0、TypeScript5.9.3、webpack5.111.1、Babylon9.30.0、Playwright-core1.64.1。

复跑：依次执行`npm test`、`npm run typecheck`、`npm run build`、`npm run build:production`；用[独立生产服务器](../coastal-cliff-d-2026-10-18/serve-dist.py)在8243端口托管dist，设置可用的`PLAYWRIGHT_PACKAGE`后执行本目录`check-browser.cjs`。输入和产物须来自同一包，不覆盖旧证据后混用。
