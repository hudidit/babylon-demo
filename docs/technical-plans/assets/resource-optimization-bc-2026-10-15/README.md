# 资源优化阶段 B、C：候选与接入记录

| 项目 | 内容 |
| --- | --- |
| 状态 | 阶段 B、C 已完成；阶段 D、E 待实施 |
| 日期 | 2026-10-15，Asia/Shanghai |
| 场景代码基线 | `7dfd21d`，包含解除限帧及静态碰撞修复 |
| 原件素材提交 | `fd32f40`，两个 GLB 摘要与阶段 A 一致 |
| 关联方案 | [资源大小优化方案](../../2026-10-14-study-resource-size-optimization.md) |
| 测量边界 | 只做静态画面、文件及请求字节、几何与功能校验；不采样 FPS、CPU/GPU 时间或加载速度 |

## 结果

| 指标 | 优化前 | 已接入版本 | 说明 |
| --- | ---: | ---: | --- |
| 古董柜 | 24,488,264 字节 / 23.35 MiB | 1,549,376 字节 / 1.48 MiB | 颜色 2K，数据与法线 1K |
| 木书架 | 15,423,708 字节 / 14.71 MiB | 2,783,464 字节 / 2.65 MiB | 颜色 2K，数据与法线 1K |
| 两个 GLB | 39,911,972 字节 / 38.06 MiB | 4,332,840 字节 / 4.13 MiB | 减少 89.14% |
| 18 个运行素材 | 51,450,194 字节 / 49.07 MiB | 15,871,062 字节 / 15.14 MiB | 减少 69.15%，其余 16 个资源摘要不变 |
| 当前生产构建产物 | 25,374,107 字节 / 24.20 MiB | 同左 | 147 个产物，应用代码与构建配置未改 |
| 生产产物＋运行素材 | 76,824,301 字节 / 73.27 MiB | 41,245,169 字节 / 39.33 MiB | 同一 `7dfd21d` 构建口径；尚未实现独立发布目录 |
| 接入后首次请求正文 | — | 24,460,902 字节 / 23.33 MiB | 22 个请求，禁用缓存、本机 HTTP 无压缩 |

阶段 A 的场景代码为 `5f5ca9a`，此前完整产物＋素材为 73.26 MiB。本轮使用 `7dfd21d` 的相同代码对照原件及候选，不把另一个版本的构建差异计入素材优化收益。体积按文件原始字节计算；来源说明及处理清单作为元数据另列，不重复计入 18 个运行素材。正式发布的复制流程与最终目录验收留在阶段 D、E。

## 阶段 B：候选与选择

共从校验过的原件生成 7 档、14 个 GLB 候选。所有 JPEG 都采用 4:4:4；数据指原金属度/粗糙度 RGB，不重新打包为 ARM。法线缩放后归一化，保留方向约定。

| 候选 | 颜色：尺寸/质量 | 数据：尺寸/质量 | 法线：尺寸/质量 | 两模型合计 | 判断 |
| --- | --- | --- | --- | ---: | --- |
| `1k-c85` | 1K / 85 | 1K / 95 | 1K / 95 | 3.12 MiB | 体积小，近景保留不足 |
| `1k-c90` | 1K / 90 | 1K / 97 | 1K / 97 | 3.94 MiB | 满足原 4 MiB 预算，但木纹偏软 |
| `1k-c95` | 1K / 95 | 1K / 98 | 1K / 98 | 4.72 MiB | 编码质量提高不能弥补颜色分辨率下降 |
| `mixed-c90` | 2K / 90 | 1K / 97 | 2K / 97 | 9.83 MiB | 近景清楚，法线体积成本过高 |
| `mixed-c95` | 2K / 95 | 1K / 98 | 2K / 98 | 11.79 MiB | 按体积排除，没有额外截图采集 |
| **`detail-c85`** | **2K / 85** | **1K / 90** | **1K / 95** | **4.13 MiB** | **选定：保留木纹分辨率，控制数据图体积** |
| `detail-c90` | 2K / 90 | 1K / 90 | 1K / 95 | 4.59 MiB | 与选定版本近景差异较小，增加约 0.46 MiB |

全 1K 候选在柜门和书架饰条上出现可见的纹理软化；提高 JPEG 质量无法恢复已缩掉的细节。选定版本保留 2K 颜色，接受数据图微表面信息的适度损失。在 1280 × 720 六个预设、两个模型近景及两个第一人称可接近位置，木纹方向、结构边缘和局部高光保持可读，未见新增明显块状伪影或错误反光。这是有损优化，不声称任意放大距离下与原件完全相同。

为保留近景颜色细节，模型预算从 4 调整为 **4.25 MiB**；当前 4.13 MiB 达标。全部素材 **16 MiB** 和生产产物＋素材 **41 MiB** 的预算保持不变，当前分别为 15.14 / 39.33 MiB。

候选近景示例：

| 候选 | 古董柜 | 书架 |
| --- | --- | --- |
| 全 1K / c90 | [柜门](candidate-1k-c90-cabinet-close.jpg) | [隔层木纹](candidate-1k-c90-bookshelf-close.jpg) |
| 2K 颜色与法线 / c90 | [柜门](candidate-mixed-c90-cabinet-close.jpg) | [隔层木纹](candidate-mixed-c90-bookshelf-close.jpg) |
| 2K 颜色 / c90 | [柜门](candidate-detail-c90-cabinet-close.jpg) | [隔层木纹](candidate-detail-c90-bookshelf-close.jpg) |

[candidates.json](candidates.json) 保存各候选字节数、摘要、编码参数和图片级误差。PSNR 和法线角度误差以“缩放及法线归一化之后、JPEG 编码之前”的像素为参考，只衡量编码损失，不包含降分辨率损失。[measurements.json](measurements.json) 的 PNG 画面差异还包含背景与 UI，不能单独作为画质合格判据。

## 工具与结构保持

本机已有 Sharp 0.35.5，没有 glTF Transform；为避免新增项目依赖及通用导出器重排几何，使用 [专用转换工具](../../../../tools/optimize-study-models.cjs) 重建图片 bufferView，按 glTF 的四字节对齐更新偏移和长度。JPEG 参数参照 [Sharp 官方说明](https://sharp.pixelplumbing.com/api-output/#jpeg)，容器按 [glTF 2.0 规范](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) 处理。

输入始终来自固定 Git 提交并验证原始 SHA256；图片按 Lanczos3 缩放，数据图不进行 gamma 变换，颜色/数据用途及材质引用沿用原件。原 glTF JSON 除 buffer 容器长度、偏移及图片长度外的语义摘要完全一致；所有非图片 bufferView 的字节摘要逐段相同，涵盖几何、索引、法线与 UV。没有增加解码器、修改材质参数或更改加载路径。

交付后再从原件重生成选定档位，两个文件 SHA256 与已接入版本完全一致。详细工具版本、交付参数、原件与交付摘要、源结构指纹和来源状态见 [独立处理清单](../../../../public/models/study-model-optimization.json)。旧模型引入历史没有上游或授权记录，如实标为 `unverified`，不混入已有 Poly Haven CC0 清单。

## 阶段 C：生产页面与交互

本轮没有修改应用 `src`、页面、构建配置或依赖文件，生产 JS 仍来自 `7dfd21d`。两个 GLB 在原路径替换；临时候选、原件备份和原始 PNG 均未进入运行素材目录。

静态截图使用独立无头 Chrome 155.0.8059.79、Apple M6 / Metal、1280 × 720 CSS 视口及渲染尺寸、设备像素比 1。场景就绪后停止自动循环，仅显式渲染截图所需的少量帧；没有恢复已停止的 FPS 测试，也没有 CPU/GPU 或加载速度结论。相机与模型参数保存于 [before.json](before.json) / [after.json](after.json)。

原件/候选对照通过浏览器路由提供对应 GLB，只用于静态画面对比。接入后的 `after` 使用普通 HTTP 直接读取当前 `public` 文件，没有素材路由替换；实际 18 个素材 URL 与磁盘清单对应，正文长度与文件字节一致。首次共有 22 个场景请求，打开 Inspector 另有 2 个分包、1,820,312 字节；视角及基本交互无新增请求。空 favicon 不计入统计，无场景请求失败或 404。首次响应正文不等于含全部调试/编辑器分包的完整交付体积。

浏览器复核确认：

- 两个模型的几何数、包围盒、冻结矩阵、碰撞、接收阴影及加入全部直接光阴影列表的属性与原件一致；材质纹理列表及运行时属性除尺寸外一致。
- 两个模型的结构与书架六个隔层保持不变，既有书本、花瓶及实际几何布局测试通过。
- 六个原预设、封闭第一人称房间及临时近景正常；W 移动、设置、返回全景和 Inspector 开关通过。
- 浏览器运行错误为 0；保留 Inspector 的 1 条非标准 `appearance: slider-vertical` CSS 告警。首次引导浮层需等待出现后按 Escape 或点击空白处关闭，测量脚本已处理，未改应用。

## 同镜头截图

所有图片直接来自浏览器，1280 × 720、JPEG 质量 95，没有后期修图。比较时使用的无损 PNG 仅保留在临时目录用于像素统计，不重复提交。

| 视角 | 原件 | 接入后 |
| --- | --- | --- |
| 全景 | [before](before-overview.jpg) | [after](after-overview.jpg) |
| 阅读区 | [before](before-reading.jpg) | [after](after-reading.jpg) |
| 书桌 | [before](before-desk.jpg) | [after](after-desk.jpg) |
| 桌面细节 | [before](before-details.jpg) | [after](after-details.jpg) |
| 藏书角 | [before](before-cabinet.jpg) | [after](after-cabinet.jpg) |
| 第一人称 | [before](before-first-person.jpg) | [after](after-first-person.jpg) |
| 古董柜近景 | [before](before-cabinet-close.jpg) | [after](after-cabinet-close.jpg) |
| 书架近景 | [before](before-bookshelf-close.jpg) | [after](after-bookshelf-close.jpg) |
| 第一人称接近古董柜 | [before](before-cabinet-first-person-close.jpg) | [after](after-cabinet-first-person-close.jpg) |
| 第一人称接近书架 | [before](before-bookshelf-first-person-close.jpg) | [after](after-bookshelf-first-person-close.jpg) |

除选定资源接入前后的十视角记录，另保存六种已截图候选的 `candidate-*.json`。`mixed-c95` 只生成资源及图片编码指标，没有额外截图，不作为已运行截图候选描述。

## 检查与复现

`npm test` 22 项通过，含 19 项既有布局/碰撞等检查，以及新增的原件结构指纹、交付图片摘要/尺寸和模型预算检查。`npm run typecheck` 与临时生产构建通过，生产构建保留既有 3 条 Webpack 体积/缓存建议告警。画面、真实加载和工具可复现性已验证；阶段 D 的独立发布及阶段 E 的整体验收仍待实施。

以下从仓库根目录、应用代码与 `7dfd21d` 一致的环境执行，使用现有本机工具依赖。转换只写指定临时目录，**不会自动替换 `public`**：

```sh
resource_dir="$(mktemp -d /private/tmp/babylon-resource-bc.XXXXXX)"
SHARP_PACKAGE=/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp node tools/optimize-study-models.cjs --output "$resource_dir/candidates"
npm run build -- --mode production --output-path "$resource_dir/build"
python3 docs/technical-plans/assets/resource-baseline-2026-10-15/serve-baseline.py --build "$resource_dir/build" --public public --port 8093
```

另一个终端设置同一 `resource_dir` 后执行：

```sh
PLAYWRIGHT_PACKAGE=/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node docs/technical-plans/assets/resource-optimization-bc-2026-10-15/capture-comparison.cjs --candidates "$resource_dir/candidates" --output "$resource_dir/screens" --profiles before,1k-c85,1k-c90,1k-c95,mixed-c90,detail-c85,detail-c90,after
SHARP_PACKAGE=/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp node tools/optimize-study-models.cjs --output "$resource_dir/reproduced" --profiles detail-c85
SHARP_PACKAGE=/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp node docs/technical-plans/assets/resource-optimization-bc-2026-10-15/measure-results.cjs "$resource_dir"
```

`measure-results.cjs` 会更新本目录的 `measurements.json`，重跑前保留需要的记录。换机器时设置实际 `SHARP_PACKAGE`、`PLAYWRIGHT_PACKAGE`、`CHROME_EXECUTABLE` 和 `BASELINE_URL`，记录编码器与浏览器变化；不同 Sharp/libvips 版本不能直接假定输出摘要相同。采集结束关闭临时服务、清理候选和构建，原件继续由 Git 历史保留。
