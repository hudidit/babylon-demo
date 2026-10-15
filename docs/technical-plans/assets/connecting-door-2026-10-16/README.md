# 收窄门洞与单扇门验收

2026-10-16，代码基线 `10fbb64`。对应[连通门方案](../../2026-10-16-connecting-door.md)。最终只安装一扇门；门洞由8收窄至4.4，砖墙、两侧护墙/踢脚线/线脚、门框同步补齐。复用原材质，18个运行素材的路径、字节和SHA256均与[基线清单](../living-room-2026-10-16/release-manifest.json)一致。

## 结果

- 46项测试、类型检查、开发及生产构建和自动发布校验通过。
- 环绕视角两面真实点击开关、0.7秒平滑动画及中途反向通过；七个环绕预设保持正常。
- 原生第一人称左键提示/开合、门关闭时两面WASD阻挡、打开双向通行通过；站在门边可以向远处打开，门扫向玩家时暂停，退开后继续；门口关门遇玩家暂停，离开后恢复。
- 原八抽屉、三灯、鼠标锁定/ESC/失败重试、设置暂停恢复、拖动缩放、速度设置和Inspector开关通过。独立信件脚本复核横竖屏、输入隔离、相机恢复、锁定返回/拒绝/重试及资源清理通过。
- 独立托管最终 `dist`，462个文件逐个HTTP GET/SHA256核验通过。实际首屏JS含必要异步为2,612,476字节（2.49 MiB），完整发布42,052,899字节（40.10 MiB），全部原预算满足。
- 浏览器无运行/着色器错误或404；保留三类既有Webpack建议告警。Chrome 155、1280×720、DPR1、禁用缓存；截图未修改。本轮没有FPS、CPU/GPU或加载耗时采样，既有亮屏性能验收继续待完成。

## 画面与记录

| 内容 | 证据 |
| --- | --- |
| 单扇门与门框完整比例 | [书房侧关闭](door-closed-study.jpg)、[客厅侧关闭](door-closed-living.jpg) |
| 打开与通行 | [环绕打开](door-open.jpg)、[第一人称门洞全貌](door-first-person-context.jpg)、[第一人称打开](door-first-person-open.jpg) |
| 关闭阻挡与玩家保护 | [贴近关闭门面](door-first-person-closed.jpg)、[关门遇玩家暂停](door-walker-protection.jpg) |
| 两房全景 | [全屋](overview.jpg)、[书房](study.jpg)、[客厅](living.jpg) |
| 功能与完整交付 | [浏览器结果及请求](browser.json)、[发布清单](release-manifest.json)、[初始模块图](bundle-analysis.json) |
| 信件回归 | [详情回归结果](inspection/inspection-browser.json) |

## 复现

先运行 `npm test`、`npm run typecheck`，再运行 `npm run build -- --output-path /private/tmp/babylon-door-development` 和 `npm run build:production`。等待生产构建成功后：

```sh
python3 -m http.server 8094 --bind 127.0.0.1 --directory dist
PLAYWRIGHT_PACKAGE=/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node docs/technical-plans/assets/connecting-door-2026-10-16/check-browser.cjs
PLAYWRIGHT_PACKAGE=/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright STUDY_URL=http://127.0.0.1:8094/ STUDY_CHECK_OUTPUT=docs/technical-plans/assets/connecting-door-2026-10-16/inspection node docs/technical-plans/assets/item-inspection-2026-10-16/check-inspection.cjs
```

浏览器脚本将渲染循环停止，以50 ms固定增量推进动画，作为功能检查，不是性能采样；Playwright/Chrome路径可按环境覆盖。构建和测试日志保存在本目录，构建日志仅移除行尾空格。
