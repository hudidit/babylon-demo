# 岛屿远景与主灯30秒周期验收

日期：2026-10-22。输入：`ad8e0cd`。实现与取舍见[技术方案](../../2026-10-22-island-overview-and-beacon-timing.md)。仅托管最终生产dist；清单SHA256为`36eb145fa776e10cb9cdda7dbc4cccc952c913f5a3aac6ec10512e224d568760`。

| 记录 | 内容 |
| --- | --- |
| [测试](tests.log)、[旧档文字复核](save-compatibility.log) | 全部361项通过；最后7项存档测试通过，旧窗口/相位/已完成10秒观察文字保留 |
| [类型](typecheck.log)、[开发构建](build-development.log)、[生产构建](build-production.log) | 按开发后生产顺序；生产自动发布校验通过，原webpack三项体积建议保持 |
| [浏览器记录](browser.json)、[摘要](browser.log)、[脚本](check-browser.cjs) | Chrome155/DPR1；原生入口/返回/地图/设置/局部试灯/存读/Inspector与释放，根/子路径首屏与495文件摘要 |
| [最终清单](release-manifest.json) | 495文件，含全部动态分包、资源来源/许可、分析及清单自身 |
| [桌面1280×800](overview-1280.jpg)、[竖屏390×844](overview-390.jpg)、[横屏844×390](overview-844.jpg) | 未改相机的初始远景；住宅和灯塔同框、两个底部入口无溢出 |
| [文档与摘要检查](documentation-check.json) | 本轮本地链接、Markdown锚点、生产清单及源文件SHA256绑定 |

主灯由真实共享时钟回调推进：7.5秒四分之一圈、15秒半圈、30秒完整一圈，灯头/空气光束/海面方向一致；暂停不补算。顶层采用已落地机位夹具，仍通过实际范围/遮挡/当地按钮权限开启试灯，无直接修改相位、Wh或完成证据。29.9秒未完成，30秒实际一圈且见出光后记录，尚余30秒；60秒时试灯到期。首层存档机位使用当前双层塔的柜位。

两个目标GLB4,332,840 B、36运行素材15,867,377 B不变；静态初始JS2,855,680 B，根/子路径实际首屏JS各3,074,532 B（含必需异步加载/着色器，Inspector另计），完整发布42,523,073 B。原4.25/16/3/41 MiB预算保持。浏览器无运行错误或缺失请求；打开Inspector后有1条Chrome的`slider-vertical`样式弃用提示，已保留原文。脚本等待Inspector初始化完成再通过原按钮关闭。

复现：先运行`npm test`、`npm run typecheck`、`npm run build`、`npm run build:production`，再执行`node docs/technical-plans/assets/island-overview-2026-10-22/check-browser.cjs`。脚本自建仅托管dist的本地HTTP并关闭；Playwright路径可由`PLAYWRIGHT_PACKAGE`覆盖，Chrome路径在脚本中明确。检查脚本不改变生产包或发布白名单。

本轮只验证Chrome桌面模拟尺寸，不宣称完整徒步、多日游玩、WebKit/Safari/Firefox、触控物理设备、FPS或加载耗时结果；历史验收仍保留其原平台与参数边界。
