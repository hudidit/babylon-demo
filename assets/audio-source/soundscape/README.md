# 环境与车辆原料（含室外试听调整）

来源与摘要见[source.json](source.json)，交付与处理见[运行清单](../../../public/audio/soundscape/source.json)。原料不进入运行白名单。

阶段C历史原料（2026-10-24复核作者页CC0）：transitking / qubodup [Water Waves](https://opengameart.org/content/water-waves)的wave_01/03/04 FLAC独立浪段，与已归档wave_02以0.85速率错位组合，交叉淡化为8秒循环；不把组合片段称为连续海岸实录。其余原料复用[阶段A归档](../soundscape-lab/source.json)：Luke.RUSTLTD的[wind1](https://opengameart.org/content/wind1)为作者PureData合成风；Ylmir的[Rain](https://opengameart.org/content/rain-loopable)为窗边单声道录音处理成的公开MP3；onursamli的[Electric Motor 2](https://freesound.org/people/onursamli/sounds/846905/)为通用电机公开HQ MP3预览，未取得原24bit WAV，也未确认是电驴实录。mitchanary的布料预览用于上下车近场接触，层级同阶段B。

[制作脚本](../../../tools/prepare-soundscape-audio.py)使用macOS AudioToolbox解码、固定选段、去直流、峰值余量、循环交叉淡化和低跳变接缝；风/海/雨另制作两级低通遮蔽版本（900/1100/1500Hz），避免运行时访问私有节点。8个循环交付AAC-LC 64k mono/96k stereo，4个短声交付PCM16 mono；AAC日期字段归零。单格式交付，无运行解码库，PCM WAV参考不随站点发布。生成清单包含参考PCM摘要、编码文件摘要、声道/时长与处理参数。

轮胎与轻刹车是项目原创固定种子`20261024`的带限噪声合成辅助，以项目ISC许可；不是购买/下载的轮胎录音。生成脚本摘要作为此原料摘要记录，种子独立于游戏天气/发现随机序列。音色、接缝和长时间重复感仍待人工耳机/扬声器试听。

## 当前室外底声（2026-10-24试听反馈）

上述Luke.RUSTLTD风与四段Water Waves组合已退出当前运行清单，原料保留供追溯；旧循环内鸟叫样声音的具体来源未作听辨认定。当前风/浪为项目原创ISC离线带限噪声近似，固定种子分别为`2026102401`和`2026102402`。不使用旧风/浪片段，不含录音鸟声或固定音调振荡器；双级低通与慢变化包络形成轻风/浪涌底声，不称为海岸实录。脚本摘要、滤波和交叉淡化参数见运行清单。独立短鸟叫的CC0原料与处理见[鸟声档案](../birds/README.md)。

替换四个风/浪后仍为12音频文件，569,508 B、参考PCM13,355,520 B；雨、车辆及上下车文件字节保持。当前运行清单只列实际使用的来源。音色与循环接缝仍需用户下一轮试听，工程验证不替代听感。
