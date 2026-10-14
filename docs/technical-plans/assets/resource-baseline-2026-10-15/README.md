# 资源优化阶段 A：书房基线记录

| 项目 | 内容 |
| --- | --- |
| 状态 | 阶段 A 已完成；未生成压缩候选或替换资源 |
| 采集日期 | 2026-10-15，Asia/Shanghai |
| 场景代码基线 | `5f5ca9a98cdefbf709fa5ffe4aecfbaed7b11663` |
| 对应方案 | [书房场景资源大小优化方案](../../2026-10-14-study-resource-size-optimization.md) |

## 交付记录

- [files.json](files.json)：18 个运行素材、12 个场景源文件、4 个构建配置文件及 147 个生产构建产物的字节数和 SHA256；另保存两个目标 GLB 的贴图尺寸、内部图片摘要、几何统计及节点信息。
- [requests.json](requests.json)：Chrome DevTools Protocol 的实际 HTTP 请求、完成/失败状态、正文及传输计数；另保存 Navigation Timing 和 Resource Timing。排除 data/blob 等内存资源，汇总排除空的 favicon 请求。
- [browser.json](browser.json)：浏览器、机器、WebGL、相机与渲染参数，8 个视角的逐帧样本、汇总和交互验证结果。
- [build.log](build.log)：本次生产构建日志。构建成功，保留 3 条 Webpack 体积/缓存建议告警。
- [collect-files.py](collect-files.py)、[serve-baseline.py](serve-baseline.py)、[capture-browser.cjs](capture-browser.cjs)：只用于基线采集的复现脚本，没有接入应用入口或修改 Webpack 配置。

## 与原方案的差异

原方案基于 `fd32f40`。之后 `5f5ca9a` 完成第 7、8 项使用痕迹与镜头后期，新增 `RoomSurfaceDetails.ts`、`RoomFinishing.ts` 和“桌面细节”视角。因此本轮以新版本作为后续资源优化的画面与运行对照，不把两个版本的画面或性能直接混比。

18 个外部资源的合计仍为 51,450,194 字节，两个目标 GLB 的 SHA256 与原方案一致；`git diff fd32f40..5f5ca9a -- public` 仅有页面视角按钮变化，没有外部素材内容变化。新增使用痕迹、纸张和后期使用代码及已有资源，没有新增外部图片或模型请求。

| 指标 | 原方案基线 | 阶段 A 新基线 | 差异 |
| --- | ---: | ---: | --- |
| 当前运行素材 | 51,450,194 字节 / 49.07 MiB | 51,450,194 字节 / 49.07 MiB | 不变 |
| 场景源码与 HTML | 75,257 字节 / 73.49 KiB | 84,789 字节 / 82.80 KiB | 新增 2 个 TS 模块；共 11 个 TS＋1 个 HTML |
| 生产构建产物 | 25,368,643 字节 / 24.19 MiB | 25,373,576 字节 / 24.20 MiB | 增加 4,933 字节，约 4.82 KiB |
| 主 JS | 8,565,863 字节 | 8,570,729 字节 / 8.17 MiB | 增加 4,866 字节 |
| 全部生产产物＋当前素材 | 76,818,837 字节 / 73.26 MiB | 76,823,770 字节 / 73.26 MiB | 增加 4,933 字节 |

文件体积按原始字节求和；1 MiB = 1,048,576 字节。147 个产物包括 HTML、主 JS、全部动态分包及许可文本。上表不是浏览器首次请求量，也不包含来源说明等未来正式发布目录的额外文件。本轮仍未实现发布复制流程。

## 浏览器与测量条件

- macOS / Darwin 27.0.0、arm64、Apple M6、12 个逻辑 CPU、24 GiB 内存。
- Google Chrome 155.0.8059.79，无头独立会话；Playwright 1.62.1；Node.js v24.21.0；Python 3.9.6。
- CSS 视口及实际渲染尺寸均为 1280 × 720，设备像素比为 1，硬件缩放为 1，应用 FPS 上限为 30。
- WebGL 2，ANGLE Metal Renderer: Apple M6，使用硬件渲染。本机无头 Chrome 与此前内置浏览器采样不是同一浏览器环境，CPU 数值不能直接视为优化收益。
- 新建浏览器上下文，CDP 禁用缓存，阻止 Service Worker；本机 HTTP 服务无 gzip/Brotli，不做网络限速，不使用用户浏览器资料。
- 临时服务将未修改的生产构建覆盖在原 `public` 目录之上。它只用于测量，不是阶段 D 的发布白名单或独立发布实现。
- 从已加载的 Webpack 模块取得现有 Engine/Scene 引用，只在临时浏览器会话中安装观察器。生产 JS 字节和磁盘上的应用源码未打补丁；检查视角期间没有额外 HTTP 请求。

## 实际请求与加载

| 阶段 | 成功请求数 | 响应正文 | CDP 传输计数 |
| --- | ---: | ---: | ---: |
| 首次加载至场景就绪 | 22 | 60,039,503 字节 / 57.26 MiB | 60,044,297 字节 |
| 六个预设及两个近景 | 0 个新增 | 0 | 0 |
| 第一人称移动、设置与返回全景 | 0 个新增 | 0 | 0 |
| 打开 Inspector | 2 个新增 | 1,820,312 字节 / 1.74 MiB | 1,820,751 字节 |

首次加载的 22 个请求为 HTML、主 JS、2 个初始动态分包及 18 个素材。18 个实际素材 URL 与 `files.json` 的运行清单完全一致。所有请求均完成，无 404、网络失败、磁盘缓存或 Service Worker 命中；另有一个 204 空 favicon 响应，不计入汇总。

打开 Inspector 仅触发当前实际需要的两个分包，不能据此将完整生产产物中其他尚未使用的编辑器等文件排除。CDP 传输计数包含协议记录的响应开销，响应正文用于与文件体积对应；它们与 Resource Timing 的计数口径分别保留。

本次成功采集的 DOMContentLoaded 为 302.60 ms，load 为 570.00 ms；现有场景“胡桃木”就绪状态在 1,198.10 ms 被观察到。该值为本机 HTTP、无压缩、单次冷上下文样本，不代表公网加载时间，也不等于 GPU 所有工作完成时间。

## 同视角截图与性能

| 视角 | 截图 | FPS | CPU 中位数 / P95 |
| --- | --- | ---: | ---: |
| 房间全景 | [overview.jpg](overview.jpg) | 30.01 | 2.70 / 3.50 ms |
| 阅读区 | [reading.jpg](reading.jpg) | 30.00 | 2.15 / 3.10 ms |
| 书桌 | [desk.jpg](desk.jpg) | 30.01 | 1.80 / 2.50 ms |
| 桌面细节 | [details.jpg](details.jpg) | 30.00 | 1.80 / 2.10 ms |
| 藏书角 | [cabinet.jpg](cabinet.jpg) | 30.00 | 1.80 / 2.10 ms |
| 第一人称 | [first-person.jpg](first-person.jpg) | 30.00 | 3.10 / 3.60 ms |
| 古董柜近景 | [cabinet-close.jpg](cabinet-close.jpg) | 30.00 | 1.60 / 1.90 ms |
| 书架近景 | [bookshelf-close.jpg](bookshelf-close.jpg) | 30.00 | 1.80 / 2.10 ms |

每个视角采样 150 个场景渲染帧，排除前 30 帧，保留后 120 帧原始数据。FPS 按后 120 帧起始时刻的 119 个间隔计算；CPU 时间为 `onBeforeRender` 至 `onAfterRender` 的场景提交耗时，包含驱动可能产生的 CPU 等待，不代表 GPU 完成时间。八个视角总顶点均为 156,084；全景活跃网格为 71，其他视角见 JSON。

所有截图直接从运行页面输出为 1280 × 720、质量 90 的 JPEG，未后期修图。六个预设保持应用原镜头。两个模型近景仅在临时浏览器中调整相机，位置、目标、FOV 和最小半径均写入 `browser.json`，没有新增产品视角。后续对比应复用这些参数、应用版本和采样条件。

本目录保留最后一次完整成功采集的数据。前一次检查在关闭 Inspector 时被首次引导浮层遮挡，已在采集脚本中通过 Escape 正常关闭引导后重跑，没有改动应用。最终开关验证通过；浏览器运行错误为 0，保留 1 条 `appearance: slider-vertical` 非标准 CSS 兼容性告警。

## 检查与复现

- `npm test`：17 项通过。
- `npm run typecheck`：通过。
- 生产构建：成功，3 条 Webpack 建议告警内容完整保存，日志仅清理行尾空白，不属于构建错误。
- 第一人称 W 移动、设置开关、返回全景和 Inspector 显示/隐藏通过；移动前后位置保存在 `browser.json`。
- 已核对素材摘要、请求正文与磁盘字节、截图尺寸、样本数量和文档链接。本任务没有修改应用 `src`、运行素材、依赖文件及构建配置。

最终核对时工作区出现独立的帧率调整与临时性能脚本改动。本目录中的源码和配置摘要已逐项与固定提交 `5f5ca9a` 的 Git 内容核对一致；本次提交仅包含资源基线及对应文档，不包含这些并行改动。未来如果修改帧率或场景代码，体积和性能比较应另建版本记录，不能将本目录的 30 FPS 上限样本当作新版本数据。

在对应场景代码版本及依赖环境下，从仓库根目录执行。下列命令会重新生成本目录的测量文件，先保留需要的既有记录：

```sh
baseline_dir="$(mktemp -d /private/tmp/babylon-stage-a.XXXXXX)"
npm run build -- --mode production --output-path "$baseline_dir/build" > "$baseline_dir/build.log" 2>&1
python3 docs/technical-plans/assets/resource-baseline-2026-10-15/collect-files.py --build "$baseline_dir/build"
python3 docs/technical-plans/assets/resource-baseline-2026-10-15/serve-baseline.py --build "$baseline_dir/build" --public public --port 8091
```

另一个终端执行浏览器采集，使用本机已有 Playwright 包和 Chrome，不要求往项目新增依赖：

```sh
PLAYWRIGHT_PACKAGE=/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node docs/technical-plans/assets/resource-baseline-2026-10-15/capture-browser.cjs
```

换机器时通过 `PLAYWRIGHT_PACKAGE`、`CHROME_EXECUTABLE`、`BASELINE_URL` 指定实际环境；记录变化后再比较。将该次构建日志保存为 `build.log`，采集结束关闭服务并清理临时构建，勿提交整个临时产物。阶段 B～E 继续待实施，4 / 16 / 41 MiB 的压缩预算仍未验证。
