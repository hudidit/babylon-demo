# 资源优化阶段 D、E：独立发布与最终验收

日期：2026-10-15。实现基于 `c076c7c`，场景代码仍为 `7dfd21d`，沿用阶段 C 的 `detail-c85` 模型。当前方案见 [资源大小优化方案](../../2026-10-14-study-resource-size-optimization.md)。本轮完成生产目录打包和验收，不继续压缩模型，也不恢复用户已停止的 FPS 测试。

## 发布方式

在项目根目录运行：

```sh
npm ci
npm test
npm run typecheck
npm run build:production
npm run verify:release
python3 -m http.server 8094 --bind 127.0.0.1 --directory dist
```

访问 `http://127.0.0.1:8094/`。部署时上传 **整个 `dist` 的内容**，保持目录结构，通过 HTTP/HTTPS 托管。`dist` 已包含运行素材及调试分包；无需另行挂载 `public`。发布校验针对最后一次生产构建；随后执行默认 `npm run build` 会以开发产物覆盖 `dist`，需要重新运行生产命令。

`npm start` 和默认 `npm run build` 继续使用原开发模式。`npm run build -- --mode production` 也会打包同样的白名单资源，但正式命令 `build:production` 还自动执行发布校验。校验其他输出目录时使用 `npm run verify:release -- /absolute/output/path`。

资源白名单见 [study-release.config.cjs](../../../../tools/study-release.config.cjs)，打包实现见 [StudyReleasePlugin.cjs](../../../../tools/StudyReleasePlugin.cjs)。当前只纳入 18 个运行素材、4 份来源/处理文档和 2 份 Babylon.js 许可说明，不复制整个 `public`；原件备份、候选、截图、依赖目录和其他示例不进入发布目录。Webpack 全部输出都保留，包含 145 个 JS 文件（主入口和全部动态分包）、HTML 与提取的许可文件，总计 147 个构建文件。

以后改变运行素材或引入外部解码器时，先更新白名单和相关来源记录，再重新执行生产构建与独立托管验收。当前 4 个 GLB 均自包含，不需要本地 Draco/KTX2 解码文件；校验拒绝未列入的 GLB 外部 URI 和扩展。来源状态见发布目录内的 `STUDY_ASSET_SOURCES.md`，旧柜体、书架和装饰画仍按已有证据标为 `unverified`。

## 体积与预算

1 MiB = 1,048,576 字节。磁盘文件字节、文件系统分配空间和网络传输分别记录。

| 项目 | 文件数 | 字节 | MiB | 预算 |
| --- | ---: | ---: | ---: | --- |
| 两个优化 GLB（包含在运行素材中） | 2 | 4,332,840 | 4.13 | ≤ 4.25，通过 |
| 运行素材 | 18 | 15,871,062 | 15.14 | ≤ 16，通过 |
| 生产 HTML、全部 JS 和许可产物 | 147 | 25,374,134 | 24.20 | 全部计入完整目录 |
| 来源、处理与库许可说明 | 6 | 39,875 | 0.04 | 计入完整目录 |
| 发布清单自身 | 1 | 35,697 | 0.03 | 计入完整目录 |
| **完整独立发布目录** | **172** | **41,320,768** | **39.41** | **≤ 41，通过** |
| 本机文件系统分配空间 | 172 | 41,693,184 | 39.76 | 另列，不替代文件体积 |

完整目录相对阶段 A 的 76,823,770 字节减少 **46.21%**，运行素材相对 51,450,194 字节减少 **69.15%**。资源压缩收益已在 B、C 实现；D、E 补齐来源说明、许可和清单，额外开销 75,572 字节。没有把排除其他示例再次算入缩减幅度，也没有以 Git 历史或开发依赖占用作为交付指标。

[release-manifest.json](release-manifest.json) 对发布文件逐项记录路径、类别、字节数及 SHA256，同时记录入口和全部 chunk。为避免自引用，清单的 `files` 和分类 `totals` 不包含自身；[verify-study-release.cjs](../../../../tools/verify-study-release.cjs) 使用清单实际字节把它加入完整目录总量和 41 MiB 预算。本轮保存的清单与 `dist` 中一致。

## 独立托管和实际请求

验收服务为标准 Python 静态服务器，仅以 `dist` 为根目录，未配置开发素材回退、URL 重写、HTTP 压缩或预压缩副本。172 个文件逐个 GET 均为 200，响应内容 SHA256 与本地文件一致，包括没有通过 Inspector 首次打开触发的其他编辑器/调试分包。额外请求未发布的 `models/barrel.glb` 得到预期 404，证明服务没有从开发 `public` 补齐；这是主动负向探针，与页面无 404 的验收分开记录。

首次检查暴露普通静态托管的 `favicon.ico` 404；此前测量服务将该路径返回 204。本轮页面添加 `data:,` 内联空图标声明，复验后页面无 404，也没有新增素材文件。生产 HTML 增加 27 字节；其余 146 个 JS/许可文件及 18 个运行素材的摘要与阶段 C 一致。

浏览器为无头 Chrome 155.0.8059.79，Apple M6 / ANGLE Metal、WebGL 2，CSS 视口和实际渲染均为 1280 × 720，DPR 1。新建上下文，禁用缓存，阻止 Service Worker。所有页面实际 HTTP 请求均指向验收本机，没有远程运行依赖。

| 请求阶段 | 请求数 | 正文原始字节 | 含响应头传输字节 |
| --- | ---: | ---: | ---: |
| 初始加载 | 22 | 24,460,929（23.33 MiB） | 24,465,171 |
| 十视角与基本交互 | 0 | 0 | 0 |
| 打开 Inspector | 2 | 1,820,312（1.74 MiB） | 1,820,701 |

初始加载包含 HTML、主 JS、两个初始动态分包及全部 18 个素材。正文比阶段 A 实际 60,039,503 字节减少 **59.26%**。这不等于完整目录大小，也不是加载时间或帧率结论。

## 画面、交互与工程检查

十个视角的相机、顶点数、活动网格数与阶段 C 记录一致；模型包围盒、UV/几何保护测试、贴图尺寸与色彩空间、冻结矩阵、碰撞、三处直接光投影记录一致。检查木纹、柜门结构、书架六层及物品、家具接触和光照，未见新增可见差异。第一人称移动、设置开启/关闭和 Inspector 开启/关闭通过。所有截图直接来自浏览器，JPEG 质量 95，没有后期修图。

| 全景与交互视角 | 细节与近景 |
| --- | --- |
| [全景](overview.jpg) | [桌面细节](details.jpg) |
| [阅读区](reading.jpg) | [古董柜近景](cabinet-close.jpg) |
| [书桌](desk.jpg) | [书架近景](bookshelf-close.jpg) |
| [藏书角](cabinet.jpg) | [第一人称古董柜](cabinet-first-person-close.jpg) |
| [第一人称](first-person.jpg) | [第一人称书架](bookshelf-first-person-close.jpg) |

截图的 JPEG 摘要与阶段 C 不完全相等，不宣称渲染像素逐点一致。验收同时依据源代码、实际运行资源及 146 个 JS/许可文件摘要一致、实际相机/模型记录一致和截图人工复核。自动循环在截图期间停止，只显式渲染所需少量帧；没有采样 FPS、CPU/GPU 或加载时间，亮屏性能继续由 [帧率专项](../../2026-10-15-room-frame-rate.md) 跟进。

- 30 项测试全部通过，包括实际 Webpack 生产打包 fixture，以及白名单缺失、动态 chunk 丢失、额外文件、同长度资源篡改、GLB 外部图片依赖、预算配置变化的失败检查。
- 类型检查、默认开发构建、生产构建和最终发布校验通过。默认开发构建在最终生产验收后另输出到临时目录，避免覆盖已验收的 `dist`。
- 浏览器无运行错误或页面请求失败。保留 1 条既有 `slider-vertical` 非标准 CSS 告警；Webpack 保留体积、入口大小及 runtime chunk 的 3 类建议告警，不把它们记为零告警。
- [build.log](build.log)、[tests.log](tests.log)、[browser.json](browser.json) 和 [measurements.json](measurements.json) 保存原始构建、测试、页面请求、交互、模型和逐文件托管记录。

## 复现验收记录

先执行上文构建命令并启动仅托管 `dist` 的服务器，然后运行：

```sh
PLAYWRIGHT_PACKAGE=/absolute/path/to/playwright BASELINE_URL=http://127.0.0.1:8094/ node docs/technical-plans/assets/resource-optimization-bc-2026-10-15/capture-comparison.cjs --output /private/tmp/babylon-resource-de-20261015/screens --profiles after
node docs/technical-plans/assets/resource-release-de-2026-10-15/measure-release.cjs
```

沿用阶段 C 的静态截图采集器，`--profiles after` 不拦截或替换模型请求。采集器中的 `sourceCodeBaseline: 7dfd21d` 表示场景代码版本；本轮发布实现基线 `c076c7c` 单独记在 `measurements.json`。按机器设置实际 `PLAYWRIGHT_PACKAGE` 和可选 `CHROME_EXECUTABLE`；本轮使用 Codex 已有的 Playwright 运行库，没有新增项目依赖。

`measure-release.cjs [build-directory] [screens-directory]` 会校验全部托管文件并更新本目录的清单、测量 JSON、浏览器 JSON 和十张 JPEG，重跑前保留需要的历史记录。它将最新产物与阶段 C 的记录比较；以后修改 JS/场景时应建立新基线，不应放宽该检查来冒充等价。验收后停止临时静态服务。

阶段 D、E 随提交 `build: 完成书房资源优化发布与验收` 保存，标识见本目录 Git 历史。首轮体积及发布目标已完成；JS 裁剪、新纹理格式、Git 历史清理和亮屏性能均留在独立后续范围。
