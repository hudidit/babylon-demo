# 两房暖米白漆面验收

日期：2026-10-16。代码基线 `4457ced`，对应[墙面替换方案](../../2026-10-16-painted-walls.md)。书房、客厅、第一人称外壳、共享墙两面和门楣统一改为细颗粒哑光乳胶漆；家具、几何、灯光、曝光、护墙和门洞保持原设置。

## 画面对比

| 内容 | 修改前 | 最终 |
| --- | --- | --- |
| 全屋 | [砖墙全景](before-overview.jpg) | [漆面全景](overview.jpg) |
| 书房 | [砖墙书房](before-study.jpg) | [漆面书房](study.jpg) |
| 客厅 | [砖墙客厅](before-living.jpg) | [漆面客厅](living.jpg) |
| 共享墙/单扇门 | [砖墙第一人称](before-door-first-person-context.jpg) | [漆面第一人称](door-first-person-context.jpg) |
| 微表面与窗边 | — | [书房漆面近景](study-paint-close.jpg)、[客厅漆面近景](living-paint-close.jpg)、[窗景与墙面](living-window-close.jpg) |

截图来自独立托管的生产dist，Chrome155、1280×720、DPR1、禁用缓存，没有图像修饰。保持原窗光和灯具参数；近景可见很弱的涂料颗粒，远景没有砖缝、裂纹或明显脏斑，窗边和墙角明暗清楚。标题增加轻微文字阴影，以适应浅墙背景。

## 工程、交互与发布

- 48项测试、类型检查、开发/生产构建及自动发布校验通过。新检查保护PNG通道/尺寸/摘要、固定种子重现、周期边界、法线向量、高粗糙度/零金属度、各面墙统一材质与UV/颜色空间，以及新发布白名单。
- 浏览器验证几何/网格/材质数量与基线一致；所有漆面材质使用颜色sRGB、法线和ARM线性数据，法线强度0.18，没有请求旧砖纹。
- 七个环绕预设、两房墙面近景/窗边、封闭第一人称、单扇门双面开合/暂停/反向/碰撞与双向通行、八抽屉/三灯、设置、拖动缩放、Inspector通过。独立信件脚本复核横竖屏、输入隔离、相机/指针锁定恢复和重复打开资源清理。
- 463个完整交付文件逐个HTTP GET与SHA256核验通过，包含全部动态分包和新漆面来源说明。页面无运行/着色器错误或运行404；另主动请求旧砖图得到预期404，证明没有从public补齐已退出发布的资源。保留三类既有Webpack建议告警。
- [浏览器结果/实际请求](browser.json)、[信件回归](inspection/inspection-browser.json)、[发布清单](release-manifest.json)、[初始模块图](bundle-analysis.json)、[素材替换与字节比较](resource-changes.json)随本轮保存。

## 纹理来源与边界

三张512² PNG由[项目生成脚本](../../../../tools/generate-painted-wall.py)离线制作，固定种子20261016；工具版本、生成器摘要、通道约定和交付摘要见[来源记录](../../../../public/textures/study/painted_wall/source.json)。它们是本项目原创细噪声纹理，不是外部扫描素材或AI图片，不继承Poly Haven许可。颜色、法线和ARM合计536,549字节，替换原三砖图；其余15素材摘要不变。旧砖图和来源保留在仓库作历史源文件，生产目录不再复制。

本轮没有FPS、CPU/GPU或加载耗时采样，不把字节变化解释为加载速度收益。既有亮屏性能专项继续待验收；只实测本机Chrome。

## 复现

运行 `python3 tools/generate-painted-wall.py` 可重建三图和来源记录；再运行 `npm test`、`npm run typecheck`、`npm run build -- --output-path /private/tmp/babylon-painted-development` 和 `npm run build:production`。等待生产构建成功后：

```sh
python3 -m http.server 8094 --bind 127.0.0.1 --directory dist
PLAYWRIGHT_PACKAGE=/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node docs/technical-plans/assets/painted-walls-2026-10-16/check-browser.cjs
PLAYWRIGHT_PACKAGE=/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright STUDY_URL=http://127.0.0.1:8094/ STUDY_CHECK_OUTPUT=docs/technical-plans/assets/painted-walls-2026-10-16/inspection node docs/technical-plans/assets/item-inspection-2026-10-16/check-inspection.cjs
```

路径可按环境覆盖。浏览器脚本停止连续渲染，以50 ms固定增量推进动画用于功能检查，不是性能采样。工程日志保存在本目录，构建日志仅清理行尾空格。
