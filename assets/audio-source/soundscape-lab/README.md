# 阶段A音频候选原件

状态：仅供声音扩充阶段A试听与验证，未选定为正式素材。获取/核对日期：2026-10-24。

逐文件来源、下载URL、作者、CC0链接、许可页摘要和文件SHA256见[source.json](source.json)。保存的五个文件均来自公开下载或公开试听入口，没有登录、购买或调用生成服务。

| 文件 | 来源与作者 | 素材层级 |
| --- | --- | --- |
| `cloth-preview.mp3` | [WindowWipe.wav / mitchanary](https://freesound.org/people/mitchanary/sounds/505171/) | 官网公开HQ MP3预览；24-bit WAV原件需登录，尚未取得 |
| `motor-preview.mp3` | [Electric Motor 2 / onursamli](https://freesound.org/people/onursamli/sounds/846905/) | 官网公开HQ MP3预览；通用电机录音，不是已确认的电驴实录 |
| `wind.wav` | [wind1 / Luke.RUSTLTD](https://opengameart.org/content/wind1) | 上传者原WAV，约60秒 |
| `rain.mp3` | [Rain (loopable) / Ylmir](https://opengameart.org/content/rain-loopable) | 作者页面直接公开的MP3试听轨，未下载ZIP包核对；有损来源 |
| `sea.flac` | [Water Waves / transitking，qubodup提交](https://opengameart.org/content/water-waves) | 原页面公开的wave 02无损FLAC摘录；约3.25秒，短于最终环境底声的理想长度 |

以上各页均明确链接CC0 1.0；保留来源不代表平台替作者核实了全部权利。主观质量、材质匹配和循环重复感仍需人实际听辨。候选不可因为本目录有文件就标为“已通过听感”或直接进入正式发布白名单。

门小样复用[既有CC0门录音](../study/README.md)，不再复制原件。全部处理参数和原件摘要由[制作脚本](../../../tools/prepare-audio-lab.py)和[候选清单](../../audio-lab/manifest.json)记录；从本目录的固定原件重建，不从AAC反复转码。macOS需允许`afconvert`访问系统音频服务，脚本只依赖Python标准库和该系统工具。

```sh
python3 tools/prepare-audio-lab.py
npm run audio:lab
```

脚本输出的WAV是候选PCM参考，不把有损MP3来源升格为无损录音。AAC用于64 kbps循环格式对比，未作为完整目标平台已验证的最终交付格式。正式B/C阶段需要按听感选择素材，必要时换成更合适的实录或取得无损原件。
