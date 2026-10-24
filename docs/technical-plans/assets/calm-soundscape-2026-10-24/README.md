# 室外声景试听调整（2026-10-24）

基线`2d61ec6`。按用户反馈降低环境底声、移除车速到环境声的增益，并把鸟叫从底声中分离。当前是供下一轮试听的工程交付，最终音色与响度由人工听辨确认；设计见[方案第17节](../../2026-10-24-game-soundscape-expansion.md#17-室外声景试听反馈调整2026-10-24)。

## 素材与规则

- 原四个风/浪循环替换为项目原创ISC固定种子带限噪声近似，不含录音鸟声或固定音调振荡器，不称海岸实录。原CC0风/浪留在仓库历史档案；未凭代码认定原鸟叫样声音的确切来源。[制作与归档](../../../../assets/audio-source/soundscape/README.md)、[当前清单](../../../../public/audio/soundscape/source.json)。
- 独立CC0海鸟短句来自Soojay公开HQ MP3预览，两处各0.65秒，非原24bit WAV。不是循环，每次只尝试一段；首次露天18～30秒，之后32～62秒。白天7～19时、非强雨；进屋、阅读/地图、设置、失焦等停止并重置，不追补。[鸟声档案](../../../../assets/audio-source/birds/README.md)、[处理清单](../../../../public/audio/birds/source.json)。
- 海浪基础增益0.17→0.055，风的晴天基准约0.106→0.025，雨0.18→0.09，仍保留原室内外/门窗/天气渐变。风浪不读骑乘、速度、驱动或制动，车辆本身的真实状态声音保持。鸟叫归环境组，未手势解锁不播放，共用原短6＋持续8声部，不提高资源上限。
- [16交付文件重建摘要](reproduction.json)一致（风/海/雨/车辆12文件及来源、鸟声2文件及来源）。雨、车辆与上下车文件内容保持；不是声音质量或循环不可闻的证明。

## 检查与复现

[462测试](tests.log)、[类型检查](typecheck.log)、[开发构建](development.log)、[生产及发布校验](production.log)通过。新增覆盖相同位置/时间/天气下环境目标与速度完全独立、鸟叫间隔上下界/昼夜/区域/天气/暂停重置、无手势/环境静音，以及鸟声循环/许可/损坏失败路径。

```sh
python3 tools/prepare-soundscape-audio.py
python3 tools/prepare-bird-audio.py
npm test
npm run typecheck
npm run build
npm run build:production
node tools/check-calm-soundscape.cjs
AUDIO_BASELINE=2d61ec6 AUDIO_CHECK_OUTPUT=docs/technical-plans/assets/calm-soundscape-2026-10-24/regression node tools/check-daily-audio.cjs
```

生成器需要macOS AudioToolbox，浏览器脚本使用本机Chrome与Playwright Core（可设`PLAYWRIGHT_PACKAGE`），只托管最终dist。脚本通过debugger捕获既有Room，不修改生产包；原生音频主输出测量与控制器事件分别记录。100接受秒配40ms真实等待用于鸟叫间隔，不加速定时器；速度对照使用固定同一站位/时间的输入夹具，真实驾驶回归另用W/Space/E。不是人工试玩、FPS或加载耗时测试。

[稀疏鸟叫浏览器记录](cadence-browser.json)与[完整交互回归](regression/browser.json)均通过，Chrome 155.0.8059.86：

- 同一站位/晴天/匹配时间，0、5与11.111m/s三个输入夹具的六个环境目标完全相同。仅风浪的主输出非零，峰值约0.003602，环境组归0输出0；该数值是默认总音量下数字波形，不是到耳响度或人工听感。
- 原控制器100接受秒（真实等待104.68秒）中原生声部启动2段鸟叫；首次24.76秒，随后间隔52.60秒，未强制播放或加速定时器。无手势尝试输出0；原生M开地图停鸟叫，实际返回按钮后重新等待，夜间/屋内停止并清空间隔，销毁关闭context。接受时间受帧步长约束，墙钟和音频时钟另列，不将它们混为精确计时或性能结论。
- 全77缓冲逐个真实Audio V2输出非零、峰值<1，实际PCM16,698,240 B。原生步行/跳跃、顶墙/骑乘、梯子/拒绝离梯、窗帘反向与地图取消、转台/试灯/低电、纸张/UI、分组静音、Inspector、失焦事件与销毁，以及单变化404降级通过。完整回归沿用阶段D夹具和边界，未冒充人工驾驶或实机OS切窗。
- 正常路径页面/控制台错误0；保留Inspector已有CSS提醒1条和Webpack体积建议3条。570发布文件根路径及`/audio-lab/`各逐项HTTP/长度/SHA256通过，包含全部动态分包/来源/许可/清单；实际首屏3,171,826 B，Inspector额外分包单列容量记录。
- 已查看[灯室](regression/lantern.jpg)及[390×844设置](regression/settings-portrait.jpg)截图，界面无水平溢出。截图不证明音色或性能。

## 容量与试听边界

[前后容量](capacity.json)、[生产发布清单](regression/release-manifest.json)记录完整交付。运行素材17,835,944→17,960,471 B，静态JS2,951,946→2,952,730 B，实际首屏3,171,042→3,171,826 B，完整发布44,778,677→44,905,425 B（567→570文件）；模型4,332,840 B保持。全部音效2,070,809 B、核心320,864 B、PCM16,698,240 B，PCM余78,976 B，所有原有上限保持。

人工风/浪近似音色、短鸟句剪辑、接缝与最终响度仍待用户下一轮耳机/扬声器试听；本轮工程通过不代表听感通过。原生Safari/Firefox/iOS/Android、系统静音/蓝牙、到耳延迟未验；未恢复FPS或加载时长实验。
