# 阶段 B 动作音效原料

2026-10-24从作者页面核实CC0 1.0。逐原料URL、SHA256、作者、许可证据、下载层级与归档成员见[source.json](source.json)。这些原料保存在发布白名单外；不把有损Ogg/MP3称为无损原件。

- 金属门：rubberduck，[100 CC0 metal and wood SFX](https://opengameart.org/content/100-cc0-metal-and-wood-sfx)，下载包的`door_open_01.ogg`和`metal_close_01.ogg`；仅归档使用的两个成员，完整ZIP摘要见清单。
- 推拉门：musicandsoundyay，[Sliding door opening and closing.wav](https://freesound.org/people/musicandsoundyay/sounds/452755/)，公共HQ MP3预览；未取得原WAV。
- 擦拭：mitchanary，[WindowWipe.wav](https://freesound.org/people/mitchanary/sounds/505171/)，复用[阶段A原料](../soundscape-lab/cloth-preview.mp3)，未复制或重复有损编码。

运行`python3 tools/prepare-action-audio.py`，需要macOS AudioToolbox的`afconvert`。固定源摘要→解码48kHz→混单声道→裁切/去直流→动作循环线性交叉淡化40ms并在淡化段选低幅低跳变接缝，短声淡入2ms/淡出12ms→峰值统一→PCM16 WAV。脚本生成14个内容寻址文件、逐文件处理记录和类型目录；交付保持WAV，不再有损压缩。循环接缝数值只证明波形连续性，主观材质与平衡仍需人工试听。

派生文件及处理参数见[发布清单](../../../public/audio/actions/source.json)，运行声部由实际门运动与清洁状态结束，无固定时长的“完成”预约。总新增325,096 B、解码648,960 B；6个动作循环与8个短声均有两种变化，既有木门来源保留。
