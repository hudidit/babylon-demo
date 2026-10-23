# 声音扩充阶段A：基线、小样与容量验证

日期：2026-10-24。基线：`debb314`。对应[主方案第13节](../../2026-10-24-game-soundscape-expansion.md#13-阶段a实施记录2026-10-24)。状态：工程与Chrome验证完成，人工听感待验；未接入正式游戏。

## 试听与复现

在项目根目录运行：

```sh
npm run audio:lab
```

终端输出本机地址，默认`http://127.0.0.1:8109/`；端口占用时设置`AUDIO_LAB_PORT`。页面先点“准备试听”，从默认35%音量开始。可逐条比较已有12音效、门轴/门扣、1.5秒布擦、连续变速电机、海风/雨/海浪与室内音量过渡；“停止全部”随时可用。地图/区域、真实车速及清洁事务的游戏接线留B/C。

原件、许可与层级见[素材档案](../../../../assets/audio-source/soundscape-lab/README.md)，制作参数和摘要见[候选清单](../../../../assets/audio-lab/manifest.json)。七个WAV参考2,502,068 B；短声WAV+循环AAC的候选组合388,326 B。实验交付保留全部格式以便比较，因此不按较小组合的字节冒充整个实验目录大小。

从固定原件重建需要macOS系统AudioToolbox：

```sh
python3 tools/prepare-audio-lab.py
node tools/audio-lab.cjs
node --test tests/audio-lab.test.cjs
node tools/check-audio-lab.cjs
node tools/check-audio-baseline.cjs
node tools/probe-audio-capacity.cjs
```

工具通过系统临时目录生成独立音频生产包/容量试验包，不覆盖正式`dist`。浏览器检查需要本机Chrome和Playwright；可用`PLAYWRIGHT_PACKAGE`指定包路径，实验检查支持`CHROME_EXECUTABLE`。`AUDIO_CHECK_OUTPUT`可另设输出，正式游戏验证可用`AUDIO_GAME_DIST`指定已构建目录。服务器只提供目标目录内文件，缺文件直接404，不从开发目录补齐。

## 证据与结论

| 文件 | 内容 |
| --- | --- |
| [lab-browser.json](lab-browser.json) | Chrome15个短声输出、8个跨至少两圈的格式测试、约440→880 Hz实时变速、取消/静音/失焦、窄屏、根/子路径完整托管 |
| [lab-manifest.json](lab-manifest.json) | 实验生产包全部39文件的长度/摘要及模块图，包括所有异步JS、两种候选格式、既有音频和许可说明 |
| [game-browser.json](game-browser.json) | 当前正式游戏12个短声逐条经RoomAudio输出、音量/静音/失焦、首次动作前静默、实际首屏JS和双路径500文件 |
| [game-release-manifest.json](game-release-manifest.json) | 与`debb314`输入逐字节相同的正式发布清单，说明未把实验候选/代码放进游戏 |
| [capacity.json](capacity.json) | 两个无损WebP探针反增1,590,534 B；更高压缩次数反增发布435 B；小样字节和后续18/3.125/44 MiB具体容量路线 |
| [tools.json](tools.json) | macOS/AudioToolbox、Python、Node、Babylon/Webpack版本及连续两次重建逐字节一致结果 |
| [tests-final.log](tests-final.log)、[typecheck.log](typecheck.log) | 430项测试及类型检查通过 |
| [development.log](development.log)、[production.log](production.log) | 开发构建与生产构建/发布校验；原有Webpack三类体积建议保留 |
| [lab-desktop.jpg](lab-desktop.jpg)、[lab-portrait.jpg](lab-portrait.jpg)、[game-audio-settings.jpg](game-audio-settings.jpg)、[visual.json](visual.json) | 独立试听页及当前游戏设置页，桌面/窄屏均无水平溢出；截图仅说明界面，不证明听感 |

正式发布：运行素材16,177,230 B、静态初始JS2,927,218 B、实际首屏JS3,145,708 B、完整目录42,987,017 B、500文件；原硬预算及白名单保持。实验总JS185,337 B，单格式PCM连同现有声音5,577,600 B；对比页同时缓存WAV/AAC，PCM为10,185,600 B。缓冲统计不等于浏览器进程内存。

后续正式接入采用运行素材18 MiB、实际/静态首屏3.125 MiB、完整发布44 MiB的容量路线，GLB仍4.25 MiB；首次接入时须在同一任务同步原则、配置/白名单与测试，本次未提前修改阈值。受控试验只能证明本次两种优化无效，不能证明没有任何其他优化空间。

## 已知边界

- 以上为真实浏览器音频图输出与状态验证，当前工具不能听辨主观音色。耳机/扬声器响度、细小循环接缝、长期重复感和是否适合场景仍待人工试听；小样不是最终选材。
- 擦拭、电机为公开HQ MP3预览，雨为页面公开MP3试听轨；没有把转出的WAV称为无损原录音。海浪只有2.5秒循环，后续优先比较更长录音。
- 浏览器的context在首次操作前可能已获运行权限；检查不强求它一定suspended，而是验证没有自发PCM输出。主音量静默检查位于最终输出，未误用主音量之前的总线分析器。
- 失焦通过浏览器内事件注入验证处理路径；没有验收物理设备切窗、蓝牙、系统静音、Firefox、原生Safari或移动设备。Chrome支持AAC不等于所有目标平台已验证。
- 没有FPS、CPU/GPU、加载时长或真实到耳延迟采样；文件与PCM差值不解释为性能收益。B～E尚未实施。
