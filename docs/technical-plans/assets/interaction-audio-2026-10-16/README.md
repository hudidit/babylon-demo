# 交互音效工程与浏览器验收

日期：2026-10-16。开发基线 `9b97534`，对应[音效方案](../../2026-10-16-interaction-audio.md)。本轮交付音效开发、来源、构建和浏览器工程验收；人工实机听感及完整跨平台验收保持待确认。

## 功能与素材

- 十二个 CC0 短音效服务八个抽屉、三盏灯、门和信件；运动/端点分开，反向、受阻、详情暂停和后台停止旧声，真实关到位才响门扣。
- Babylon Audio V2 精确入口懒加载，十二个共享缓冲、二十四个预备声音对象、全局最多六个活动实例。常用版本先加载，最多两个加载/解码任务；失败按项隔离，自动重试有限，显式手动恢复只处理失败项。
- 环绕和详情二维，第一人称空间声；原始左手坐标与 Web Audio 坐标一同转换声源及 listener。工具栏/详情静音、音量、试听与持久化均已接入。
- 选用 laleksic 的 [Various Sound Effects](https://opengameart.org/content/various-sound-effects) 八个实物录音原件，作者按 CC0 发布。原件与来源见[开发归档](../../../../assets/audio-source/study/README.md)，交付及处理记录见[来源 JSON](../../../../public/audio/study/source.json)。不含 AI 或程序合成音频。
- 48kHz 单声道 PCM16 WAV 合计287,568字节（0.274MiB），P0为126,984字节；缓冲PCM合计574,080字节。无损短文件已满足预算，因此无需有损编码器或格式副本。

## 工程和交付

[60项测试](tests.log)、[类型检查](typecheck.log)、[开发构建](development-build.log)、[生产构建](production-build.log)及[发布复核](release-check.log)通过。保留三类既有Webpack建议告警。

| 指标 | 实际 | 预算 |
| --- | ---: | ---: |
| 目标GLB | 4,332,840字节 / 4.13MiB | 4.25MiB |
| 运行素材 | 15,702,135字节 / 14.97MiB | 16MiB |
| 静态初始JS | 2,475,683字节 / 2.36MiB | 3MiB |
| 场景可用时实际JS | 2,626,814字节 / 2.51MiB | 3MiB |
| 场景及音效全部预热JS，保守统计 | 2,694,535字节 / 2.57MiB | 3MiB |
| 完整发布，含清单 | 41,934,890字节 / 39.99MiB | 41MiB |

[资源比较](resource-changes.json)确认旧十八个运行素材摘要全部不变。完整[发布清单](release-manifest.json)和[模块分析](bundle-analysis.json)保存；生产目录独立托管后[最终488个文件逐项GET/SHA256核验](hosted-release.json)通过，未从开发public补齐。没有提高总预算、排除动态分包或删除Inspector。

[重现记录](reproducibility.json)确认 `python3 tools/prepare-study-audio.py` 两次输出的十二个文件及来源JSON摘要相同；工具仅使用Python标准库，从原件裁切、去直流、定峰值并加边缘淡入淡出，不重复有损编码。

## 浏览器证据

- [Chrome音频图检查](audio-browser.json)：Chrome155、1280×720、DPR1、禁用缓存；首次操作前全部声音停止且PCM输出为0。验证试听真实输出、静音保存、注入单项404后场景仍可操作及手动恢复、门开合和转头声道、失焦停止且恢复不补播。
- 六个校准声音的叠加样本峰值约0.160，未削波。第一人称右侧门声右声道峰值约0.0933，左声道接近0；转头后的左侧样本左/右约0.0611/0.0406，方向正确。
- 使用测试专用AudioWorklet在音频线程累计声道峰值，避免短声在画面渲染结束前播放完而漏测；它仅存在验收脚本，不进入应用。测试使用50ms固定动画增量，不是FPS或加载速度实验。
- [原场景回归](regression/browser.json)和[信件详情回归](inspection/inspection-browser.json)通过，包含八抽屉、三灯、门双面/受阻/碰撞/通行、相机/拖动缩放、设置、Inspector、横竖屏详情和指针锁定恢复。
- [/demo/子路径及手机尺寸设置](subpath-browser.json)：十二个音频、动态JS及来源页均保留部署子路径；390×844和844×390面板可用。网络断言仅统计HTTP请求，GLB内嵌图片的blob不属于外部网络依赖。
- [其他引擎记录](audio-engines.json)：临时WebKit26.5通过十二个片段的真实播放、PCM输出、真实手势、零音量静默和静音刷新后不加载音频，正常页无运行错误或HTTP失败。Firefox153运行时无法启动：本机沙箱扩展/默认帧缓冲错误，标为未验证而非通过。
- [原生Safari可用性](safari-availability.json)：Safari27的现有设置未开启远程自动化，会话创建被拒绝；没有改动系统浏览器设置。WebKit通过不能等同于Safari产品层已完整验证。

正常Chrome检查无运行错误、着色器错误或运行404；缺失音频实验在独立页面主动注入404。Chrome与WebKit检查均为无头音频图验证，**不能证明扬声器/耳机听感、实际系统静音、蓝牙延迟或iOS/Android设备行为已验收**。原生Safari、Firefox以及完整非Chrome场景回归尚待合适环境补验。没有进行FPS、CPU/GPU或加载速度采样。

## 画面

[音频设置](audio-settings.jpg)、[手机尺寸音频设置](audio-settings-portrait.jpg)、[详情横屏](inspection/inspection-landscape.jpg)、[详情竖屏](inspection/inspection-portrait.jpg)保存。截图用于UI/画面核对，不能替代声音试听。

## 复现

```sh
python3 tools/prepare-study-audio.py
npm test
npm run typecheck
npm run build -- --output-path /private/tmp/babylon-audio-development
npm run build:production
python3 -m http.server 8095 --bind 127.0.0.1 --directory dist
```

在另一个终端设置可用Playwright模块路径；本机为 `/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`，版本1.62.1。运行：

```sh
PLAYWRIGHT_PACKAGE=/path/to/playwright node docs/technical-plans/assets/interaction-audio-2026-10-16/check-audio.cjs
PLAYWRIGHT_PACKAGE=/path/to/playwright STUDY_URL=http://127.0.0.1:8095/ STUDY_CHECK_OUTPUT=docs/technical-plans/assets/interaction-audio-2026-10-16/regression node docs/technical-plans/assets/painted-walls-2026-10-16/check-browser.cjs
PLAYWRIGHT_PACKAGE=/path/to/playwright STUDY_URL=http://127.0.0.1:8095/ STUDY_CHECK_OUTPUT=docs/technical-plans/assets/interaction-audio-2026-10-16/inspection node docs/technical-plans/assets/item-inspection-2026-10-16/check-inspection.cjs
```

Chrome默认使用本机应用路径，也可设置 `CHROME_EXECUTABLE`。其他引擎使用临时测试运行时，不修改package.json或系统浏览器设置：

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/study-audio-test-browsers node /path/to/playwright/cli.js install firefox webkit --no-progress
PLAYWRIGHT_PACKAGE=/path/to/playwright PLAYWRIGHT_BROWSERS_PATH=/private/tmp/study-audio-test-browsers node docs/technical-plans/assets/interaction-audio-2026-10-16/check-audio-engines.cjs
```

子路径检查时，把同一个最终dist放到普通静态站点的`demo/`目录并在8096端口托管，运行 `check-subpath.cjs`；本次临时站点只将最终dist挂到该子目录，没有开发资源回退或特殊URL路由。原生Safari须在已有可用自动化环境补验；当前限制保持记录。

收尾视觉检查修正手机英文副标题与新增工具栏的重叠。最终手机截图/子路径检查和完整HTTP摘要复核对应修正后的生产目录；修正仅改变手机CSS，未改已回归的应用代码或音频素材。跨引擎脚本在存在无法启动的平台时返回状态码2，不能把未启动记录算成通过。

最终完整托管摘要检查可运行 `node docs/technical-plans/assets/interaction-audio-2026-10-16/verify-hosted.cjs` 重现。
