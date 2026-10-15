# 书房交互验收记录

日期：2026-10-16，代码基线 `42da8b5`，对应[技术方案](../../2026-10-16-room-interactions.md)。新增八个抽屉、两盏灯开关与第一人称中心交互，不新增运行素材或依赖。

## 验证条件与复现

使用本机 Chrome、1280 × 720、DPR 1，禁用缓存及 Service Worker，只托管最终生产目录；浏览器版本与 WebGL 信息见 [browser.json](browser.json)。截图时停止自动循环，通过少量显式帧检查画面，固定 50 ms 动画步长仅用于确定性地推进开合，不采集 FPS、CPU/GPU 或加载时间，不据此宣称性能收益。

```sh
npm test
npm run typecheck
npm run build -- --output-path /private/tmp/babylon-interactions-dev
npm run build:production
python3 -m http.server 8096 --bind 127.0.0.1 --directory dist
PLAYWRIGHT_PACKAGE=/absolute/path/to/playwright node docs/technical-plans/assets/room-interactions-2026-10-16/check-browser.cjs
```

Playwright 使用现有运行库，不添加项目依赖。可通过 `STUDY_URL`、`STUDY_DIST`、`STUDY_CHECK_OUTPUT`、`CHROME_EXECUTABLE` 指定托管来源、最终目录、记录目录与浏览器。

指针锁定检查同时等待 `pointerLockElement` 和相机输入附加完成，避免在 `pointerlockchange` 回调执行前误发第一笔移动。ESC 后的短暂重锁间隔遵循 Chrome 自身限制。失焦路径用 `window` 的 blur 事件模拟；其余锁定、鼠标、键盘与点击使用浏览器事件。

## 结果

- 38 项测试、类型检查、开发构建、生产构建及自动发布校验通过。保留三类既有 Webpack 体积/入口/runtime 建议告警；本次浏览器未记录运行/着色器错误、404 或 console 告警。
- 通过真实指针点击逐一打开、关上八个抽屉，检查动态矩阵与碰撞；两盏灯点击后照明和发光材质归零，再次点击恢复原值。右键与拖动离开再回到原位均不误触。
- 第一人称成功取得 Pointer Lock，未按鼠标键即可环顾，WASD 移动有效；中央射线可操作抽屉和两盏灯，圆点与开/关提示同步。ESC 恢复进入前的书桌视角并隐藏圆点；浏览器直接释放、模拟失焦、锁定拒绝、设置暂停后点击画面恢复均通过。
- 五个环绕视角和第一人称截图人工复核；抽屉内部、光照与投影正常。拖动旋转、滚轮缩放、速度设置/恢复及 Inspector 开关通过，调试关闭后相机仍可拖动。
- 462 个完整发布文件全部逐个 GET，响应成功、字节 SHA256 与本地一致，含所有未触发动态分包、来源/许可、分析报告与清单。交互本身新增请求为 0。

| 指标 | `42ed45b` 历史基线 | 本次结果 | 预算 |
| --- | ---: | ---: | ---: |
| 目标 GLB | 4,332,840 字节 | 4,332,840 字节 / 4.13 MiB | 4.25 MiB |
| 运行素材 | 15,871,062 字节 | 15,871,062 字节 / 15.14 MiB | 16 MiB |
| 静态初始 JS | 2,435,614 字节 | 2,444,862 字节 / 2.33 MiB | 3 MiB |
| 实际首屏 JS，含必要异步 | 2,586,745 字节 | 2,595,993 字节 / 2.48 MiB | 3 MiB |
| 完整发布目录，含清单 | 42,024,493 字节 | 42,034,608 字节 / 40.09 MiB | 41 MiB |

首屏 JS 增加 9,248 字节，完整目录增加 10,115 字节；素材摘要保持不变。新增交互物件从静态合并中分离，增加局部网格/绘制批次，运动时刷新阴影；不据此推断 FPS 或加载时间变化。

实际首屏的四个 JS 为 `js/4259.js`、`js/main.js`、`js/1203.js`、`js/8558.js`，全部计入统计。详细请求与各步骤结果见 [browser.json](browser.json)，交付与模块图见 [release-manifest.json](release-manifest.json)、[bundle-analysis.json](bundle-analysis.json)，工程检查见 [tests.log](tests.log)、[development-build.log](development-build.log)、[build.log](build.log)。

## 可复核画面

- [全景](overview.jpg)、[阅读区](reading.jpg)、[书桌](desk.jpg)、[桌面细节](details.jpg)、[藏书角](cabinet.jpg)。
- [书桌抽屉](writing-drawer-1-open.jpg)、[窗边桌抽屉](console-drawer-2-open.jpg)、[古董柜抽屉](cabinet-drawer-2-open.jpg)。
- [台灯开](desk-lamp-on.jpg) / [关](desk-lamp-off.jpg)，[落地灯开](floor-lamp-on.jpg) / [关](floor-lamp-off.jpg)。
- [第一人称中央圆点与动作提示](first-person.jpg)。

本目录随功能、测试及方案一同提交，提交标识见 Git 历史。旧帧率专项的亮屏性能验收继续保持待完成。
