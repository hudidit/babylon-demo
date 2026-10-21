# 灯塔天气步骤四：完整存档与独立演练验收

日期2026-10-22，输入基线`1533c6e`（含最新夜间光束）。[实施方案及实际结果](../../2026-10-22-lighthouse-weather-state-save.md)；本次提交目的“完成灯塔天气完整存档与独立演练”，由本目录及源码Git历史定位。

## 最终包

最终生产清单SHA256：`53c97930bec6c934bb707c07bd42254ae718dd8c1cc2cdbefc6953ad56ae4034`。[执行记录](run-checks.json)在每套执行前后绑定完整运行源码和清单，保存脚本与结果摘要；[证据核查](evidence-check.json)确认七套同包、缓存恢复、迁移隔离、资源及预算。[生产清单](release-manifest.json)、[依赖报告](bundle-analysis.json)、[发布校验](release.json)覆盖完整交付，历史脚本中的旧baseline标签不能替代本轮清单绑定。

版本2保存天气序列/过渡、精确自动小时/补偿/风险余量、部件/问题/冷却与有界历史、四随机流、太阳能薄膜、访问/线索及已记线索编号，连同原设备/Wh/库存/期限/纸质记录一起恢复。继续先暂停，不补算离线、不重新抽数或增加设备事件，未完成动作不提交。低层版本1编码仅用于历史兼容夹具，所有玩家保存均版本2。

正常键`babylon-lighthouse-duty-v1`沿用，明确继续旧槽才一次迁移，先成功写入再应用；失败、损坏、未知版本保留原数据。独立演练使用`babylon-lighthouse-exercise-v2`，固定天气进入副本；种子重开新演练，返回正常恢复原会话。切换不自动保存；刷新从正常新会话开始，选择演练后才能明确继续演练槽。主界面与设备面板明确标记演练。

## 工程及七套现场检查

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| 工程 | 334项测试，新增8项完整检查点测试；类型、开发/生产构建及发布校验通过，原3项webpack体积建议保持 | [测试](tests.log)、[检查点](checkpoint-tests.log)、[类型](typecheck.log)、[开发](build-development.log)、[生产](build-production.log) |
| 保存刷新与缓存 | 默认风险率，初始化前种子3069，经5,400次原0.1秒共享回调自然产生薄膜；首次漏检后原生保存/刷新/选演练/继续，恢复同一缓存及一次抽数；关闭自动时间仍可完成缓存检查。离开10自动分钟后第二次漏检、5秒细查、清洁/历史失效/独立复查、中断和完整保存通过 | [脚本](check-save.cjs)、[结果](discovery/discovery.json)、[日志](save.log) |
| 迁移与隔离 | 旧槽写入拒绝不应用/不丢原数据，成功迁移一次、重复继续不换种子；损坏槽不覆盖且只清当前槽。正常槽/内存保持，0与4294967295各重开两次复现，越界输入拒绝 | 同上结果中的migrationAndIsolation、seedReplays、returned、migrated |
| 菜单 | 正常与固定雾副本来回恢复完整检查点，不自动写槽；1280×800、390×844、844×390按钮在屏内，无横向溢出；子路径实际首屏与根路径相同 | [脚本](check-menu.cjs)、[结果](menu/menu.json)、[桌面](menu/menu-1280.jpg)、[竖屏](menu/menu-390.jpg)、[横屏](menu/menu-844.jpg) |
| 原夜间光束 | 海面亮带GPU差异、远近/顶层、白天待机/试灯、暂停/恢复、雾雨和三尺寸通过，原716网格/575,398顶点/108材质/22灯/22渲染目标保持 | [脚本](check-browser.cjs)、[结果](after/browser.json) |
| 双引擎画面 | Chrome155.0.8059.86/WebKit27.2 × 三视口 × DPR1/2，共48天气/昼夜参考条件；光束/海面同源、雾密度和渲染尺寸正确 | [脚本](check-matrix.cjs)、[结果](matrix/matrix.json) |
| 原住宅及生命周期 | 8抽屉、8灯、7门、55段通行、地图/物品/设置/Inspector等原回归；三轮创建/释放和新增模式/种子监听器归零 | [适配器](suite-adapter.cjs)、[回归](regression/regression.json)、[重建](recreate/recreate.json) |
| 独立发布 | 只托管最终dist，根和`/home/`各495文件GET/长度/SHA256通过；36运行素材与输入基线逐项一致，完整分包及说明均计入 | [发布脚本](check-release.cjs)、[结果](release.json) |

[刷新后的完整演练](discovery/refreshed-full-save.jpg)、[两次漏检](discovery/two-misses.jpg)、[确认薄膜](discovery/confirmed-film.jpg)、[纸质记录](discovery/honest-paper.jpg)、[独立复查](discovery/independent-recheck.jpg)、[保存继续](discovery/save-boundary.jpg)、[旧档升级](discovery/migrated-v1.jpg)为核心现场参考。

上述新现场/画面套件错误与告警均为空；工程构建仍有既有三项webpack建议。回归中的预期负向操作按原脚本断言。完整保存现场在Chrome执行，WebKit结论限天气画面；没有Firefox/Safari/物理设备结论。

## 字节与边界

| 指标 | 输入1533c6e | 本步 | 预算 |
| --- | ---: | ---: | ---: |
| 两目标GLB | 4,332,840 B | 4,332,840 B | 4.25 MiB |
| 36运行素材 | 15,867,377 B | 15,867,377 B | 16 MiB |
| 静态初始JS | 2,843,591 B | 2,855,365 B | 3 MiB |
| 实际首屏（含必需异步） | 3,062,443 B | 3,074,217 B | 3 MiB |
| 完整发布（含分包/说明/清单） | 42,510,439 B | 42,522,931 B | 41 MiB |

实际首屏增加11,774 B，完整发布增加12,492 B，预算不变。没有新增素材、依赖、几何、灯、纹理、相机或RTT；不把字节数据写成加载速度或FPS收益。

镜头使用站稳同楼面位置夹具，风险使用原默认率和原共享有界回调；未直接写污损、Wh、日序或检查证据。生成薄膜后通过原手动时间选点查看正午输入，并明确开启自动继续；该选点不被计作经过时间。离开区域由位置夹具完成，不能声称为全程人工步行、多日实际游玩或频率平衡实验。纯逻辑压力规则只验边界，不作为玩家故障率依据。

本轮只交付天气步骤四；步骤五平衡、天气预报和三天剧情任务/消息/结尾尚未实现。故事/探索独立槽和章节状态留剧情第一步，当前正常/演练隔离不能代替故事恢复。

## 复现与诊断

环境：Node24.21.0、TypeScript5.9.3、webpack5.111.1、临时Playwright Core1.64.1，临时浏览器客户端不加入项目依赖。执行`npm run typecheck`、`npm test`、`npm run build`、`npm run build:production`；只用[托管脚本](serve-dist.cjs)启动最终dist（`STUDY_PORT=8255`，根及子路径）。设置`PLAYWRIGHT_PACKAGE`为本机Core路径、`PLAYWRIGHT_BROWSERS_PATH`为匹配WebKit目录、`STUDY_URL=http://127.0.0.1:8255/`，执行本目录`run-checks.cjs`，再执行`verify-evidence.cjs`；runner可按套件名重跑，清单或运行源码变更时应先归档旧执行记录。

[首轮可选空字段比较诊断](diagnostics/serialization-comparison.json)和[日志](diagnostics/serialization-comparison.log)保留旧包：断言直接比较JS对象时将恢复后的可选undefined与JSON缺省字段混比，改为比较序列化状态，未放宽数值或随机校验。`diagnostics/initial-package/`另保留旧包已通过的画面/原功能结果与被终止的诊断；它们不属于最终清单验收。

代码审查同时发现恢复后位置锚点等到自动小时才解除，会阻止手动时间下的现场检查。改为首个有效活跃帧恢复位置，离开时长继续只计自动小时；最终现场新增“关闭自动后仍返回缓存结果”的明确断言并通过。自然生成夹具从216改为3069，以更早产生同类两次漏检，减少有界回调数量，默认风险率保持。最终生产包七套已全部重跑，只有根目录执行绑定和证据核查表示最终通过。
