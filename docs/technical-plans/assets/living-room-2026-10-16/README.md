# 相邻客厅验收记录

- 基线：`36df0b1`；日期：2026-10-16。
- 对应[扩建方案](../../2026-10-16-adjacent-living-room.md)。所有截图来自独立托管的生产目录，1280×720、DPR 1、Chrome 155；没有修改截图，没有 FPS、CPU/GPU 或加载耗时采样。
- 复用现有 18 个素材，其路径、字节和 SHA256 与[信件功能交付](../item-inspection-2026-10-16/release-manifest.json)一致；没有新增下载资源、依赖或预算例外。装饰画和窗景沿用已有来源记录，未改变其许可状态。

## 工程与浏览器检查

- 44 项测试、类型检查、开发构建、生产构建和自动发布校验通过。新增回归覆盖双向门洞、门洞外实体墙/外围墙/沙发碰撞、步行边界、光源分区、独立灯开关、阴影缓存，以及单网格批次转换父节点时保持画作/窗景世界位置。
- 七个环绕预设、客厅家具/壁炉/陈列柜/窗帘近景、封闭第一人称、门洞两侧通过视觉复核。真实 WASD 从 X=16 走至约22.71、反向从24走至约17.29，眼高保持1；门洞以外的共享墙阻挡正常。
- 八个书房抽屉、三盏灯的环绕与中心点击、ESC 返回、原生/拒绝锁定、设置暂停恢复、拖动/缩放、速度设置、Inspector 开关与返回后控制通过。
- [独立信件回归](inspection/inspection-browser.json)检查横竖屏居中、固定镜头、输入隔离、位置与朝向恢复、返回锁定/拒绝/重试及重复打开资源清理，全部通过。
- 462 个完整交付文件逐个 HTTP GET 与 SHA256 一致，含全部动态调试/编辑器分包和来源/许可文件。浏览器无运行/着色器错误和404；保留三类既有 Webpack 建议告警。

## 画面

| 内容 | 截图 |
| --- | --- |
| 双房全景 | [全景](overview.jpg) |
| 原书房视角 | [书房](study.jpg)、[阅读区](reading.jpg)、[书桌](desk.jpg)、[桌面细节](details.jpg)、[藏书角](cabinet.jpg) |
| 客厅 | [预设](living.jpg)、[会客区近景](living-seating-close.jpg) |
| 装修与陈列 | [壁炉](living-fireplace-close.jpg)、[陈列柜](living-display-close.jpg)、[窗帘与窗景](living-window-close.jpg) |
| 第一人称 | [客厅](living-first-person.jpg)、[书房通往客厅](connecting-passage.jpg)、[客厅回看书房](study-from-living.jpg) |
| 台灯交互 | [开灯](living-lamp-on.jpg)、[关灯](living-lamp-off.jpg) |

## 字节与适用边界

最终字节以 [browser.json](browser.json)、[发布清单](release-manifest.json)和[初始模块图](bundle-analysis.json)为准，具体比较见扩建方案。素材保持15.14 MiB、两个目标GLB保持4.13 MiB；静态初始JS约2.35 MiB，包含必要异步JS的实际首屏约2.49 MiB，完整目录约40.10 MiB，均满足原预算。

客厅增加几何、灯光与阴影图，预算通过不表示 FPS 或加载耗时已改善。既有亮屏帧率专项继续待验收。本轮实测浏览器为本机Chrome，其他浏览器未实测。壁炉是装饰炉膛与木柴，无动态火焰。

## 复现

先运行 `npm test`、`npm run typecheck`，再运行 `npm run build -- --output-path /private/tmp/babylon-living-development` 与 `npm run build:production`。等待生产构建成功后，用普通静态服务器托管 `dist`：

```sh
python3 -m http.server 8094 --bind 127.0.0.1 --directory dist
PLAYWRIGHT_PACKAGE=/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node docs/technical-plans/assets/living-room-2026-10-16/check-browser.cjs
PLAYWRIGHT_PACKAGE=/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright STUDY_URL=http://127.0.0.1:8094/ STUDY_CHECK_OUTPUT=docs/technical-plans/assets/living-room-2026-10-16/inspection node docs/technical-plans/assets/item-inspection-2026-10-16/check-inspection.cjs
```

Playwright路径与Chrome可执行文件可按环境覆盖。脚本停止连续渲染循环，以固定50 ms增量手动推进动画用于功能检查，不能解释为帧率样本。测试/开发/生产构建日志保存在本目录。
