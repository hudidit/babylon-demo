# 书房 Tree-Shaking 实施与验收

日期：2026-10-15，基线提交 `6dea648`。方案见 [书房 JavaScript Tree-Shaking 优化方案](../../2026-10-15-study-tree-shaking.md)。本轮优化生产首屏依赖，保留全部 Inspector/编辑器分包，不修改 18 个运行素材或画质参数。

## 结果

| 指标 | 基线 | 最终 | 变化 |
| --- | ---: | ---: | --- |
| 实际首屏 JS，包括必需异步 JS | 8,585,185 字节 / 8.19 MiB | 2,586,745 字节 / 2.47 MiB | 减少 **69.87%** |
| 首屏 JS，gzip level 9 离线 | 1,904,555 字节 | 613,784 字节 | 减少 67.77% |
| 首屏 JS，Brotli quality 7 离线 | 1,549,462 字节 | 529,690 字节 | 减少 65.81% |
| 首次请求正文，无 HTTP 压缩 | 24,460,929 字节 / 23.33 MiB | 18,462,521 字节 / 17.61 MiB | 减少 **24.52%** |
| 首次请求数量 | 22，含 3 个 JS | 23，含 4 个 JS | 增加 1 个 |
| Inspector 首次打开，额外正文 | 1,820,312 字节 / 2 请求 | 3,665,321 字节 / 5 请求 | 部分能力移至按需调试路径 |
| 完整发布目录 | 41,320,768 字节 / 39.41 MiB | 42,024,493 字节 / 40.08 MiB | 增加 703,725 字节 / 0.67 MiB |
| 运行素材 | 15,871,062 字节 / 18 文件 | 15,871,062 字节 / 18 文件 | SHA256 全部一致 |

1 MiB = 1,048,576 字节。本轮收益为首屏 JS 和实际初始请求量；完整目录仍含全部调试及编辑器能力，不能把主 JS 文件或某个 vendor 分包单独作为首屏总量。完整目录仍满足 41 MiB 预算，增加量包含分包变化、新增 115,553 字节模块分析报告及更长的发布清单。运行素材和来源/许可文档不变。

最终首屏 JS 来自 `js/4259.js`、`js/main.js`、`js/1203.js` 和 `js/8558.js`；前两件是静态入口（合计 2,435,614 字节），后两件为启动中实际加载的必需异步分包。四件全部计入 2,586,745 字节，未将延迟请求排除来夸大裁剪。视角切换及交互没有新增请求。离线 gzip/Brotli 逐文件编码后求和，服务器实际仍发送未压缩正文；不以这些估算宣称已启用 HTTP 压缩或已测得加载时间改善。

## 实施内容

- [应用入口](../../../../src/app.ts) 仅启动书房，将未实例化的火箭示例移至 [Rocket.ts](../../../../src/examples/Rocket.ts)。其他示例和素材保留。
- 书房运行模块使用 `@babylonjs/core/pure`，区分 `import type`。实际使用的 CreateBox/CreateSphere 等函数替代 MeshBuilder 聚合对象。
- [RoomRuntime.ts](../../../../src/examples/RoomRuntime.ts) 显式登记 WebGL 纹理/渲染目标/Uniform、HDR 立方体、原始及动态纹理、MRT、动态缓冲、默认材质和 PBR/贴图解析、射线、碰撞及原有手柄输入。阴影及 SSAO/默认后期构造器登记自身场景组件。
- 四个交付 GLB 的 `extensionsUsed`/`extensionsRequired` 均为空，使用 `@babylonjs/loaders/glTF/2.0/glTFLoader` 核心加载器，排除 glTF 1.0 和整组扩展；未来修改资产能力时同步修改加载器和发布校验。
- Webpack 跨初始及异步 chunk 共享模块，对重复的 shader include 分成 GLSL/WGSL 共享组；多初始分包使用独立文件名，保留动态分包访问。
- [RoomShaders.ts](../../../../src/examples/RoomShaders.ts) 显式导入已有启动路径请求的 26 个 WebGL 着色器。中间版本一度产生 49 个初始请求；此举将其收口到 23 个，没有删除 shader 或关闭效果。DefaultRenderingPipeline.prepare 会初始化部分关闭状态效果对应的 shader，这些也如实保留。
- [依赖分析工具](../../../../tools/study-bundle-analysis.cjs) 根据实际 Webpack chunkGraph 采集 501 个初始源模块，并拦截无关大系统。允许 glTF 核心使用的 FlowGraphInteger 值类型和 SSAO/深度使用的点云类型判定小工具；没有纳入流程图执行器或高斯点云渲染器。
- 生产构建自动生成 [bundle-analysis.json](bundle-analysis.json)，静态初始 JS 上限为 3 MiB；[发布校验](../../../../tools/verify-study-release.cjs) 复核模块图、入口字节与预算。浏览器测量再次将必需异步 JS 纳入同一 3 MiB 上限。
- 不升级 Babylon 9.30.0、不把第三方包强行标为无副作用、不删除 Inspector、不改变材质和光照来减小体积。

## 验证

同一机器的无头 Chrome 155.0.8059.79、Apple M6 / ANGLE Metal / WebGL 2，视口与渲染尺寸 1280 × 720、DPR 1。新建上下文、禁用缓存、阻止 Service Worker，仅托管生产目录，未挂载开发 public 或启用 HTTP 压缩。全部页面请求来自同一个本机来源，全部 462 个发布文件逐个 GET，正文 SHA256 与本地文件一致。

对比相机、顶点数、活动网格、GLB 包围盒/贴图/冻结矩阵/碰撞/投影、材质类别与贴图尺寸/色彩空间、HDR/环境光参数、三处直接光投影、SSAO 与后期、两种相机输入：记录全部一致。十组静态截图人工复核未见新增可见退化，不宣称截图摘要或所有像素完全一致。

第一人称移动、鼠标拖动旋转、滚轮缩放、速度调到 2× 再恢复，以及 Inspector 打开/关闭通过。关闭 Inspector 后仍使用同一个引擎和场景。截图期间停止自动循环，只显式渲染所需少量帧；不采样 FPS、CPU/GPU 或加载时间。

33 项测试、类型检查、开发及生产构建、发布校验通过。新增独立进程的 pure 注册检查，验证相机输入、PBR/贴图克隆、射线和真实碰撞，避免原几何测试的总入口预注册掩盖问题；新增初始模块检查，以及在摘要和统计均一致时仍拒绝超预算 JS 的失败检查。

浏览器无运行错误、shader 错误或 404。保留 1 条既有 slider-vertical 非标准 CSS 告警和 3 类 Webpack 体积/入口/runtime chunk 建议告警。

## 同镜头截图

所有 JPEG 直接来自浏览器，质量 95，无后期修图。

| 视角 | 基线 | 优化后 |
| --- | --- | --- |
| 全景 | [基线](before-overview.jpg) | [优化后](after-overview.jpg) |
| 阅读区 | [基线](before-reading.jpg) | [优化后](after-reading.jpg) |
| 书桌 | [基线](before-desk.jpg) | [优化后](after-desk.jpg) |
| 桌面细节 | [基线](before-details.jpg) | [优化后](after-details.jpg) |
| 藏书角 | [基线](before-cabinet.jpg) | [优化后](after-cabinet.jpg) |
| 第一人称 | [基线](before-first-person.jpg) | [优化后](after-first-person.jpg) |
| 古董柜近景 | [基线](before-cabinet-close.jpg) | [优化后](after-cabinet-close.jpg) |
| 书架近景 | [基线](before-bookshelf-close.jpg) | [优化后](after-bookshelf-close.jpg) |
| 第一人称柜体 | [基线](before-cabinet-first-person-close.jpg) | [优化后](after-cabinet-first-person-close.jpg) |
| 第一人称书架 | [基线](before-bookshelf-first-person-close.jpg) | [优化后](after-bookshelf-first-person-close.jpg) |

## 记录与复现

- [before.json](before.json)、[after.json](after.json)：实际请求、渲染环境、相机与模型、材质/后期配置及交互。
- [measurements.json](measurements.json)：前后所有首屏 JS、离线压缩参数与字节、完整目录变化、462 个文件的 HTTP 校验。
- [release-manifest.json](release-manifest.json)、[bundle-analysis.json](bundle-analysis.json)：最终文件清单及实际初始模块/分包。
- [tests.log](tests.log)、[build.log](build.log)、[development-build.log](development-build.log)：最终工程检查记录。

在仓库根目录运行：

```sh
npm test
npm run typecheck
npm run build:production
npm run verify:release
python3 -m http.server 8094 --bind 127.0.0.1 --directory dist
```

当前静态截图采集器和汇总工具：

```sh
PLAYWRIGHT_PACKAGE=/absolute/path/to/playwright node docs/technical-plans/assets/tree-shaking-2026-10-15/capture-browser.cjs --output /private/tmp/babylon-tree-shaking-20261015/screens-after
node docs/technical-plans/assets/tree-shaking-2026-10-15/measure-results.cjs
```

工具默认使用 `http://127.0.0.1:8094/`；可配置 BASELINE_URL 和 CHROME_EXECUTABLE。Playwright 来自现有 Codex 运行库，没有增加项目依赖。

完整前后复现时，先在独立检出中使用 `6dea648` 和相同锁定依赖生成基线生产目录，保存到临时目录的 `before/`；同一 URL 托管基线，采集到 `screens-before/`。再托管当前 `dist` 并采集 `screens-after/`。`measure-results.cjs [temporary-directory] [final-build-directory]` 会对比这些记录并更新本目录的 JSON、截图和日志。不同依赖、浏览器或构建路径可能改变产物摘要，应重采基线，不把不匹配记录当作等价。

默认开发构建会覆盖 dist，验收时使用独立 output-path 或重新运行生产构建。本次开发构建输出在临时目录，最终 dist 保留已验收生产产物。验收后停止临时静态服务。

本方案及代码、测试、截图和原始记录随 `perf: 裁剪书房首屏 Babylon 依赖` 提交保存，标识见本目录 Git 历史。后续 Brotli 部署、缓存和素材分级加载独立推进，本轮不以首屏字节缩减比例承诺实际等待时间改善。
