# 物品详情查看验收

日期：2026-10-16，基线 `1ba3708`，对应[技术方案](../../2026-10-16-item-inspection.md)。本轮给桌上的信增加固定角度的居中详情模式，并建立可查看物品注册。

## 实现与检查结果

- 点击桌上的信或第一人称中心射线均能打开详情。副本共享原信件的几何和动态文字贴图，固定正交相机和独立图层只展示物品，复用现有最终后期；原件继续保留在桌面，未更改其几何、UV、变换或资源。
- 原生模态 dialog 管理焦点与底层 UI 隔离，下方提供“返回”；鼠标拖动、WASD、方向键与滚轮不改变详情镜头，Tab 不进入场景控件。桌面 1280 × 720、竖屏 390 × 844、横屏 844 × 390 的物品均居中且返回按钮完整位于下方。
- 环绕视角返回恢复原位置和目标。第一人称返回恢复原位置与朝向，按钮返回恢复指针锁定；ESC 一次只退出详情，随后可点击画面重新锁定或再按 ESC 退出第一人称。模拟返回锁定拒绝时，位置仍恢复且移动暂停，点击画面可重试成功；模拟失焦不丢失详情与保存状态。
- 重复进入/退出不增加网格、材质或纹理数量，副本不参与碰撞/拾取/阴影；原材质与纹理未销毁。同一引擎仍仅有一个场景，新相机无输入，原相机姿态没有被预设重置。
- 41 项测试、类型检查、开发与生产构建、发布校验通过；独立 pure 进程验证预览克隆、材质和共享纹理清理。回归八个抽屉、两盏灯、第一人称、拖动/缩放、设置和 Inspector，通过全部 462 发布文件 GET 与 SHA256 校验。
- 浏览器未记录运行/着色器错误、404 或 console 告警；保留三类既有 Webpack 体积/入口/runtime 建议告警。详情交互额外 HTTP 请求为 0。

## 资源与发布

| 指标 | `1ba3708` | 本次 | 预算 |
| --- | ---: | ---: | ---: |
| 目标 GLB | 4,332,840 字节 | 4,332,840 字节 / 4.13 MiB | 4.25 MiB |
| 运行素材 | 15,871,062 字节 | 15,871,062 字节 / 15.14 MiB | 16 MiB |
| 静态初始 JS | 2,444,862 字节 | 2,449,619 字节 / 2.34 MiB | 3 MiB |
| 实际首屏 JS，含必要异步 | 2,595,993 字节 | 2,600,750 字节 / 2.48 MiB | 3 MiB |
| 完整发布目录，含清单 | 42,034,608 字节 | 42,040,871 字节 / 40.09 MiB | 41 MiB |

18 个运行素材的字节和 SHA256 完全一致，无新素材、解码器、依赖或预算调整。实际首屏四个 JS（4259、main、1203、8558）全部计入；增加 4,757 字节，完整发布增加 6,263 字节，所有动态分包和来源/许可仍交付。详情增加一台固定相机，并在查看期间暂时增加一个共享几何副本和一个展示材质；不因此推断 FPS 或加载时间收益。

## 证据与复现

- [详情浏览器记录](inspection-browser.json)：实际请求、共享资源、输入隔离、三种尺寸投影及按钮位置、进入/返回相机和指针锁定结果。
- [原有交互与完整发布回归](regression/browser.json)、[发布清单](release-manifest.json)、[初始模块/分包](bundle-analysis.json)。
- [测试](tests.log)、[开发构建](development-build.log)、[生产构建与发布校验](build.log)。
- [桌面信件](letter-on-desk.jpg)、[详情](inspection-desktop.jpg)、[竖屏](inspection-portrait.jpg)、[横屏](inspection-landscape.jpg)、[返回桌面](returned-to-desk.jpg)、[第一人称信件焦点](first-person-letter-focus.jpg)。原有视角/抽屉/灯具截图在 `regression/` 中。

浏览器为本机 Chrome 155.0.8059.79 / WebGL 2，DPR 1，禁用缓存与 Service Worker，独立托管最终 `dist`。截图时停止自动循环，使用少量显式帧和 50 ms 确定动画步长。没有采样 FPS、CPU/GPU 或加载耗时，既有帧率专项的亮屏验收仍待完成。

窗口尺寸变化后等待实际引擎宽高更新；第一人称锁定前调用 `bringToFront` 恢复原生窗口焦点，并等待锁定事件及相机输入附加完成。macOS Chrome 在测试窗口尺寸变化后曾返回 `WrongDocumentError`，恢复前台焦点后通过，参见 [Playwright 原生焦点问题记录](https://github.com/microsoft/playwright/issues/20956)。锁定拒绝和窗口失焦的失败分支通过明确模拟检查，不把模拟当作真实拒绝统计。

在仓库根目录运行：

```sh
npm test
npm run typecheck
npm run build -- --output-path /private/tmp/babylon-inspection-dev
npm run build:production
python3 -m http.server 8097 --bind 127.0.0.1 --directory dist
PLAYWRIGHT_PACKAGE=/absolute/path/to/playwright node docs/technical-plans/assets/item-inspection-2026-10-16/check-inspection.cjs
PLAYWRIGHT_PACKAGE=/absolute/path/to/playwright STUDY_URL=http://127.0.0.1:8097/ STUDY_EXPECTED_INTERACTIONS=11 STUDY_CHECK_OUTPUT=docs/technical-plans/assets/item-inspection-2026-10-16/regression node docs/technical-plans/assets/room-interactions-2026-10-16/check-browser.cjs
```

沿用原交互脚本并增加可选的期望交互数量参数，历史默认仍为 10，本轮显式为 11。Playwright 来自现有运行库，不增加项目依赖。证据与功能同一任务提交，提交标识见 Git 历史。
