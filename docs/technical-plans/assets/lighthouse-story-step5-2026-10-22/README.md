# 灯站剧情步骤五验收证据

输入基线 `a7178ce`。范围、问题修复和体验结论见[技术方案](../../2026-10-22-lighthouse-story-acceptance.md)。运行包只来自最终 `dist`，无开发服务器补文件、运行素材或预算调整。

## 检查及重现

先在仓库根目录运行 `npm test`、`npm run typecheck`、`npm run build`，最后运行 `npm run build:production`。保留的日志分别为 [tests.log](tests.log)、[typecheck.log](typecheck.log)、[development-build.log](development-build.log)、[production-build.log](production-build.log)。生产构建完成后再执行浏览器脚本，期间不要重建 `dist`。

各浏览器脚本自行启动只读的本地 `dist` 服务器，同时支持根路径与 `/home/`。Playwright 使用 `/private/tmp/dsh-playwright/node_modules/playwright-core`，Chrome 使用系统安装，WebKit 默认 `/private/tmp/lighthouse-step5-browsers/webkit-2370/pw_run.sh`，可用 `PLAYWRIGHT_WEBKIT_EXECUTABLE` 指定已安装兼容版本。这些是本机验收工具，不是项目运行依赖。

| 命令（仓库根目录） | 证据与边界 |
| --- | --- |
| `node docs/technical-plans/assets/lighthouse-story-step5-2026-10-22/check-playthrough.cjs` | 新故事完整材料路线，从正式书桌入口持续 W/S/E、鼠标交互与登梯完成全篇；相机仅改变朝向，不写位置、楼层或工作证据 |
| 上一命令加 `--minimal` | `/home/` 新开故事，跳过可选阅读和个人日记的熟练重玩；同样连续往返 |
| 上一命令加 `--travel` | 原始引擎渲染循环和时间步的一次书桌至灯塔旅行；工程脚本掌舵样本，不是首次玩家或性能实验 |
| `node docs/technical-plans/assets/lighthouse-story-step5-2026-10-22/check-branches.cjs` | 8场景编号 × 6路径 × 不间断/逐节点恢复，共96路线；完整原模型与严格封套，不是几何通行验收 |
| `node docs/technical-plans/assets/lighthouse-story-step5-2026-10-22/check-epilogue.cjs` | 沿用步骤四的局部几何/射线夹具，复验全篇原生UI、后台/取消等待、消息与结尾存读、低电备用、失败保护、44故事＋4设备布局 |
| `node docs/technical-plans/assets/lighthouse-story-step5-2026-10-22/check-regression.cjs` | 根/子路径各496文件HTTP GET与SHA256、原住宅/灯站/地图/Inspector/暂停/释放及4远景布局；设备局部定位不冒充连续旅行 |
| `node docs/technical-plans/assets/lighthouse-story-step5-2026-10-22/check-originals.cjs` | 沿用原车辆骑乘/路面车灯像素和三轮重建/监听器释放脚本，仅适配当前入口/时钟默认值/就绪回调，旧证据不覆盖 |
| `node docs/technical-plans/assets/lighthouse-story-step5-2026-10-22/check-recovery.cjs` | 从自然低电的白天雾档原生细查/擦拭/复查、首层守候回充、电池柜确认恢复和再次存读；明确局部设备定位，不用柴油或直接补能 |
| `node docs/technical-plans/assets/lighthouse-story-step5-2026-10-22/check-engines.cjs` | Chrome与WebKit新档、白天雾中备用完整存读、核对待回复、结尾未看/已看；4状态 × 4尺寸 × 2引擎共32布局 |
| `node docs/technical-plans/assets/lighthouse-story-step5-2026-10-22/check-evidence.cjs` | 最终包与源码/摘要绑定、已通过结果、预算、文档链接、未改核心与素材、测试/构建日志及图片摘要 |

`node docs/technical-plans/assets/lighthouse-story-step5-2026-10-22/analyze-rhythm.cjs` 从已通过路线回执重算[节奏数据](rhythm.json)。两路线各1,410节点、1,977.76m步行、80.5m登梯净高度，参考活跃35.5分钟；原始引擎单次旅行201.82m、墙钟188.074秒。阅读717/545字符及暂停时间与活跃分别记录，详细九阶段表见技术方案。

`--first` 和 `--home` 仅是分别校准第一章、住宅门扇与回桌的小原型，不作为完整通关。连续路线使用 `playthrough-harness.cjs`，模型路线使用 `model-fixture.cjs`。`check-epilogue.cjs` 与 `check-regression.cjs` 是步骤四验收脚本的本轮独立副本，结果与新的最终包重新绑定，历史目录不被覆盖。

## 方法与通过条件

固定参考路线每渲染帧50 ms，按生产控制器扫掠、实际键盘绑定、门扇防夹、登梯和有效时钟结算。参考秒、运行脚本的墙钟秒、等待推进的岛上小时分别保存在各阶段，不将加速渲染的运行时间叫作玩家时长。按钮读取很快，另记原文字符数；没有将脚本阅读当成玩家理解测试。界面暂停、实际移动/登梯、现场工作和等待都维持原权限。

模型路线覆盖普通、全材料、提前处置、迟到雾窗、长时间游览后接班、极晚交接。逐节点恢复后，任务完成时间和最终完整存档SHA256应与相同有效命令的不间断路线一致。低电仅用当前玩家允许的面板检查/清洁、日照回充、守候回充与电池柜复验；不启动柴油机、不赠送Wh，不用退回备选的维修命令通过验收。两次漏检来自真实独立检查流和不同有效访问，反复检查同一访问不额外抽取，5秒细查后可确定处置。

首屏统计持续至场景就绪和初次操作解锁音频后的必需异步分包完成；章节分包在进入故事后另计。完整发布包含所有未触发动态分包及说明文件。所有最终结果需绑定同一 `release-manifest.json` SHA256，36运行素材与步骤四逐文件相同。

## 数据与截图

- [新档全材料](new-story-all-notes/playthrough.json)、[跳过可选的重玩](replay-minimal/playthrough.json)、[真实渲染旅行](real-render-travel/playthrough.json)：阶段、步行节点/采样、距离、阅读原文、等待停止原因与最终状态；各自子目录包含关键章节图片。
- [96路线与存读节点](branches.json)、[原生太阳能回充](recovery.json)、[双引擎结果](engines.json)、[原生UI与尾声回归](chapters-browser.json)、[原功能与发布](regression.json)、[车辆和三轮重建](originals.json)、[文档/同包检查](documentation-check.json)。
- [白天雾中备用档](fog-backup-save.json)由原始设备/天气/剧情模型自然推进至低电保护，再经严格编码产生；浏览器原生继续/保存必须保持完整内容不变。它用于回归本次恢复顺序修复。
- [六份尾声检查点](checkpoint-samples.json)保存第三章、留站登记、夜间开始、核对待回复、结尾未看和已看，用于恢复与故障重试。双引擎同时读取步骤四保留的有效历史档，验证旧档兼容。
- [发布清单](release-manifest.json)和[聚焦测试日志](focused-tests.log)供回溯。`attempts/` 保留校准失败摘要及被排除的旧命令候选，均不计入最终通过记录；说明见[失败与校准记录](attempts/README.md)。

## 结论边界

本轮可证明当前代码和同一生产包的工程可玩性、真实路径连通与状态接续。自动脚本熟悉路线，未邀请外部首次玩家；80—110分钟原目标不能据此视为达成。WebKit自动化不等于物理Safari/iOS设备认证。天气子项目步骤五的长期随机分布、实机性能与加载耗时收益仍不在本轮结论内。
