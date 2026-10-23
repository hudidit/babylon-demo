# 大灯一键检查验收

2026-10-23，输入提交 `3d0ddf4`。实现与边界见[方案](../../2026-10-23-lighthouse-simple-check.md)。

- `tests.log`：408项通过；`typecheck.log`、`development.log`、`production.log`：类型/开发/生产构建通过，生产构建沿用三条webpack体积建议。
- `sources.json`：最终运行改动及测试源码SHA256；`release-check.json`：完整发布496文件、预算通过。
- `network.jsonl`、`requests-summary.json`：最终生产根页面12个首屏JS请求，含必需异步JS共3,145,670B，距3MiB余58B。该数字不是加载耗时或FPS实验。
- `check-hosted.cjs`、`hosted-check.json`：只从dist托管，根与/home/各496文件GET、长度、SHA256一致。
- `gallery-fixture.cjs`、`fixture-webpack.cjs`：同源码另建站位夹具，定位/朝向及只读诊断，不替换时钟delta、旋转相位或生成完成证据。需要先生产构建，再运行 `./node_modules/.bin/webpack --config docs/technical-plans/assets/simple-lamp-2026-10-23/fixture-webpack.cjs`，将 `viewport.html` 复制至 `/private/tmp/simple-lamp-fixture/`，启动 `node docs/technical-plans/assets/simple-lamp-2026-10-23/serve.cjs`；8770只托管dist，8771为夹具（素材来自dist）。
- `browser.json`：原生E触发、转身继续、3秒完成（白天墙钟2.999秒）、切换入夜时保持导航；菜单17秒暂停期间进度不变；离开取消、背向重试成功。最后补充 E 主动复查，再次检查同样3秒完成；最终桌面完成图与窄屏图已刷新。程序只设置站位，不视为完整徒步通关。
- `day-complete.jpg`、`night-complete.jpg`、`paused-resume-progress.jpg`：1280×720。`narrow-progress.jpg`、`narrow-complete.jpg`：390×844 iframe布局，页面DOM已核实尺寸，3秒完成（墙钟3.006秒）。调试读数是夹具内容，其窄屏长行不属于交付界面；正式提示/圆环可读。

最终生产根页面无错误/告警。旧夹具在生产目录重建期间曾读到模型404，保存于浏览器历史日志；最后窄屏工具会话记录一条无源码位置的MutationObserver错误，业务检查仍完成，不能宣称整段工具会话零错误。内置浏览器视口覆盖未生效，改用真实390×844 iframe并复验。灯座按钮/梯口路由通过生产处理器测试，原鼠标拾取未取得可靠新证据。未验手机触控、完整路线、Inspector、物理设备或性能。

提交目的：`简化大灯检查为顶层一键三秒完成`；通过本目录Git历史定位提交。
