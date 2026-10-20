# 灯塔玩法减量与现场界面验收

日期：2026-10-21。输入基线`ccbdc3f`。范围见[方案](../../2026-10-20-lighthouse-focused-experience.md)。以下根/子路径结果绑定同一最终生产清单；旧步骤二、三的演练验收保留历史范围，不计入本轮玩家玩法。

## 检查与结果

- [267项测试](tests.log)、[类型检查](typecheck.log)、[开发构建](development-build.log)及[生产构建/自动发布检查](production-build.log)通过。生产构建保留3条webpack默认体积建议，硬预算未改。
- [浏览器脚本](check-browser.cjs)及[根路径结果](browser/browser.json)、[子路径结果](subpath/browser.json)：Chrome155.0.8059.85、1280×800/DPR1生产页面；八类设备实点、四组备选入口移除、最多两个仪表和桌面无长滚动；实际按钮确认读数、试灯10秒连续观察/转动与出光、走开重置、地图暂停与恢复；保护面擦拭中断不清除、成功闭环/待复查/实际复查；太阳能巡视自动带检测工具；记录按设备过滤、每页五条、三项完成汇总、Tab循环/Esc返回及销毁释放通过。390×844、844×390检查仪表与纸面，无水平溢出；矮屏保留垂直滚动。
- 计时由原生产`updateTimeOfDay(.05)`接受的活跃凭据驱动。设备间使用合法附近落地站位夹具；动作均通过原射线/距离/楼层权限和真实点击，不写入故障、电量、库存或巡检证据。观测环中心与屏幕中心误差小于1px，进行动作时隐藏旧交互提示，完成闭环依赖真实结果；中断不会打成功标记。
- [发布脚本](check-release.cjs)与[结果](release.json)：只托管最终`dist`，根路径及`/home/`各495个文件GET、长度、SHA256通过；36运行素材逐项与上步相同，所有动态分包与来源说明均在交付内。
- 浏览器两条路径均无运行/着色器错误、404或警告。资源维持717网格、576,812顶点、106材质、153纹理、22灯、3相机；本轮无新增渲染资源或运行素材。HTML/CSS/SVG图面为项目原创。

## 字节与边界

| 指标 | 上步最终包 | 本轮最终包 | 预算 |
| --- | ---: | ---: | ---: |
| 两目标GLB | 4,332,840 B | 4,332,840 B | 4.25 MiB |
| 运行素材 | 15,867,377 B | 15,867,377 B | 16 MiB |
| 静态初始JS | 2,790,142 B | 2,783,636 B | 3 MiB |
| 实际首屏JS，含必需异步，根/子路径 | 3,008,994 B | 3,002,488 B | 3 MiB |
| 完整发布目录，含所有动态分包及清单 | 42,444,702 B | 42,443,658 B | 41 MiB |

[最终清单](release-manifest.json) SHA256为`81ccacc5e05920cd433904286d1ed42a6a62fd8e50d2ad8d89b2972d5d39a6be`，另存[依赖分析](bundle-analysis.json)及[源码/脚本/结果摘要复核](verification.json)。Node24.21.0、TypeScript5.9.3、webpack5.111.1、Babylon9.30.0、Playwright-core1.64.1。浏览器请求在场景及音频就绪时统计全部JS，不把静态入口代替实际首屏。

首屏JS较上步少6,506 B、完整发布少1,044 B。这是字节差异，不证明加载速度、FPS或玩家学习成本的量化收益。本轮未重做连续住宅至灯塔路线、多日压力、双卫反射/车辆专项、WebKit/Firefox/Safari或物理设备；原几何/碰撞/能量逻辑测试保持，既有验收不可扩写为本轮实测。界面主观体验仍待用户体验反馈。

## 过程记录

[早期站位诊断](attempts/record-stand-fixture.json)停在记录夹：夹具错误复用了首层运行面板站位，原权限正确拒绝远距离操作。改用记录夹前方`.65,1.15`的原合法站位后，最终包根/子路径完整通过。早期截图中的旧提示重叠及纸面字号在最终包修正，最终截图均随最终包重采。首次批量GET并发10超过Python默认监听队列，出现ECONNRESET；降低为并发2后全部文件逐项校验通过，不忽略HTTP或摘要错误。

## 复跑

先依次运行`npm test`、`npm run typecheck`、`npm run build`、`npm run build:production`。用原[独立服务器](../coastal-cliff-d-2026-10-18/serve-dist.py)托管生产目录，端口8242；配置`PLAYWRIGHT_PACKAGE`为可用Playwright-core目录后：

```sh
node docs/technical-plans/assets/lighthouse-focused-experience-2026-10-21/check-browser.cjs
STUDY_URL=http://127.0.0.1:8242/home/ STUDY_CHECK_OUTPUT=docs/technical-plans/assets/lighthouse-focused-experience-2026-10-21/subpath node docs/technical-plans/assets/lighthouse-focused-experience-2026-10-21/check-browser.cjs
node docs/technical-plans/assets/lighthouse-focused-experience-2026-10-21/check-release.cjs
```

## 代表画面

[控制器仪表](browser/solar-controller-desktop.jpg)、[手机仪表](browser/solar-controller-390.jpg)、[纸质记录](browser/paper-journal-desktop.jpg)、[观察进度环](browser/observation-ring-partial.jpg)、[观察闭环](browser/observation-ring-complete.jpg)、[清洁进度环](browser/cleaning-ring.jpg)、[复查记录](browser/cover-paper-records.jpg)。
