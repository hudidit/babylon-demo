# 灯站文案验收

输入基线`93974e4`。对应[实施方案](../../2026-10-22-game-copy-and-voice.md)与[文案规范](../../../game-writing-guide.md)。技能来源、固定提交、MIT许可、安装文件摘要及热度查询日期见[skill-sources.json](skill-sources.json)。已逐文件比较安装的SKILL.md与当时检查的固定来源，两份一致。技能只作编辑参考，没有执行它们附带的脚本。

## 工程与交付

[383项测试](tests.log)、[类型检查](typecheck.log)、[开发构建](development-build.log)和[生产构建/发布校验](production-build.log)通过。新增4项测试针对显示文案与原存档隔离、取消通知在原发送时刻的知识、报告读数/导航/真实待办和旧呼号不明身份；原测试只调整相应文字匹配，未放宽状态、时长、能量或坏档要求。

[check-chapters.cjs](check-chapters.cjs)走原生三章、实际设备操作、等待/复查、存读、分包失败重试与释放；[check-regression.cjs](check-regression.cjs)复核原功能及完整交付。结果分别写入[chapters-browser.json](chapters-browser.json)、[regression.json](regression.json)，以各自`passed`字段和最终源文件/清单摘要为准。[check-evidence.cjs](check-evidence.cjs)检查同包证据、截图摘要、文档链接、未变化核心、原始消息及严格校验函数，结果在[documentation-check.json](documentation-check.json)。

最终生产清单SHA256：`6183fc3788be9f30d3b793958b25f55940080cfad4b88fc8421b2e9c0ab03a6e`。只托管最终dist，根与`/home/`完整文件都须GET成功并匹配长度/摘要。所有动态分包、说明和清单计入完整发布；不从public补文件。

| 指标 | 最终结果 | 原预算 |
| --- | --- | --- |
| 两目标GLB | 4,332,840 B | 4.25 MiB |
| 36项运行素材 | 15,867,377 B，逐文件与输入一致 | 16 MiB |
| 静态初始JS | 2,923,445 B | 构建检查3 MiB |
| 实际首屏JS，含全部必需异步 | 3,142,297 B | 3 MiB |
| 进入故事后另请求的章节交互 | 17,411 B，`js/3690.js`，完整交付 | 单列后续请求 |
| 完整发布 | 42,641,690 B / 496文件 | 41 MiB |

首屏较输入增加426 B，余3,431 B；完整发布增加3,557 B。未改预算、白名单、依赖、几何、材质、光照、原时钟或能量模型。webpack保留原3项体积建议；Inspector仍有原1条`slider-vertical`样式弃用提示。

## 页面与文案

Chrome155.0.8059.86、DPR1、无service worker。信件、雾天任务、生活旧页、交接任务及交接单共5类页面，在1280×800、390×844、844×390、320×640检查20项布局；设备读数页检查4项，房屋/海岸地图检查8项。检查对话框边界、横向溢出、滚动、固定页脚和可用控件。长文通过原生滚动阅读，未缩小字体或裁删内容来通过检查。

- 周师傅的交接信：[桌面](zhou-letter-1280.jpg)、[手机](zhou-letter-390.jpg)、[320窄屏](zhou-letter-320.jpg)。
- 岸站：[接班回复](shore-arrival-reply-1280.jpg)、[交接单](handover-report-1280.jpg)、[原生滚动到末尾](handover-report-end-1280.jpg)、[手机](handover-report-390.jpg)。
- 设备：[读数与操作](device-input-reading-1280.jpg)、[窄屏](device-input-reading-320.jpg)、[风雨限制](storm-outside-restricted-1280.jpg)。
- 任务与生活：[海雾任务](fog-task-1280.jpg)、[雨天工作](storm-work-plan-1280.jpg)、[旧日志](life-notes-1280.jpg)、[个人记录](personal-record-1280.jpg)。

正文、标题、按钮、提示与辅助标签一起核对。旧消息仍按原ID/发送时间/来源严格校验；查看新文字不会修改原始模型状态。正文分包加载失败时禁用已读按钮，重开后可继续。报告值取提交时事实，不读当前仪表冒充历史；日间试灯、白天待机、主灯/备用/无导航及实际待办分别表述。尚未实际接班、未查明原因和旧呼号来源不明都保留。

## 等待诊断与范围

一次生产复核在第3日06:10（42.1667接受小时）遇到新表面变化，等待按规则提前停下，此时风雨工作时段已经开放。原脚本仍强求到42.5小时，下一次等待被“先做当前工作”正确拒绝。[诊断记录](wait-stop-diagnostic.json)与[日志](wait-stop-diagnostic.log)保留该过程。只调整验收夹具：在真实工作窗口已就绪时继续原生操作；没有修改游戏等待规则、跳过检查、强改时间或补造设备证据。雨后窗口采用相同原则。

现场使用有记录的站姿/射线定位与原共享时钟0.1秒回执，等待使用生产批处理；无伪造任务、Wh、问题、圈数或清洁结果。记录不代表完整步行、外部玩家测试、中文可读性研究、FPS或加载速度收益。原住宅无署名英文旧页及历史档案保持原有含义，不擅自归为周师傅的个人经历；四组备选复杂检修、唐宅和未开放的尾声不在本次新增玩法范围。
