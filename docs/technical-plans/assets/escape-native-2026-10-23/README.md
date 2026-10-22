# ESC 原生按键复查

日期：2026-10-23；输入基线：`908ee13`。对应[方案补修结果](../../2026-10-23-escape-view-toggle.md#实际修改与原生验收)。

- [原生输入记录](native-input.json)：在有窗口Chrome中使用 `cua_repl` 的系统按键与单击，读取真实DOM按钮状态/地图标记。ESC进入、W直接移动、锁鼠退出/返回和两轮往返、三种界面优先级及子路径通过；补充原生按住ESC 800ms、无中间观察的两次连续调用、切走标签页再返回后的ESC。没有写相机或指针锁定状态。
- [原始HTTP脚本请求](network.jsonl)、[首屏统计](requests-summary.json)：仅托管最终dist，响应 `no-store`，记录浏览器 `sec-fetch-dest: script` 的真实请求；根路径与 `/home/` 各12请求/3,145,675B，包含必需异步着色器，保留3MiB预算（余53B）。文件验证用Node请求，不混入浏览器脚本统计。
- [完整发布验证](release-check.json)、[清单](release-manifest.json)、[代码摘要](sources.json)：两个路径各496文件状态/长度/SHA256通过。36项运行素材15,867,377B、两目标GLB4,332,840B、静态初始JS2,926,823B、完整目录42,655,597B。
- [396测试](tests.log)、[类型](typecheck.log)、[开发](development.log)、[生产/发布](production.log)。新增未锁鼠普通输入可用、暂停与物品查看仍阻断的回归。生产保留三项webpack体积建议，最终浏览器阶段无运行错误/告警；临时诊断已清除。

复现：执行 `npm test`、`npm run typecheck`、`npm run build`、`npm run build:production` 后运行 [serve.cjs](serve.cjs)，在**前台、有窗口的Chrome**打开其根路径与 `/home/`，按记录逐步用系统ESC/W及鼠标操作；每一步先确认界面结果再继续。脚本只托管dist并记录HTTP，不自动操作浏览器。普通CDP按键的成功不能代替此处原生验收。

原生Chrome可能拒绝ESC重锁，届时第一人称和WASD照常恢复，点击画面启用环顾，不需再点“自由探索”。未测其他浏览器/实机、完整塔下往返或性能；长按/连续输入仅覆盖上述有限样本。旧方案内无头检查的覆盖范围独立保留，不据此扩大本轮结论。
