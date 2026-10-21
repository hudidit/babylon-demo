# 天气与风险步骤一验收

日期2026-10-21，输入基线`1f9ef6c`。范围以[子项目三步骤一](../../2026-10-20-lighthouse-project-03-weather-and-uncertainty.md#步骤一实现及验收记录2026-10-21)为准，当前六组玩家玩法不变。本阶段交付纯逻辑，尚未连接Room；当前生产包与子项目二步骤五相同。

## 结果

- [298项全量测试](tests.log)（新增19项）及[类型检查](typecheck.log)通过；[开发](development-build.log)/[生产](production-build.log)构建及自动发布校验通过。webpack保留原3项构建建议告警。
- [纯模型脚本](check-models.cjs)及[结果](models.json)：种子0/1/123/20261021，每种以1/6、1/60、1/600场景小时三种步长重放48小时及相同维护命令，完整快照摘要逐种一致。0.2/0.15事件率为压力夹具，不是默认0.006/0.004的平衡验收；事件列表含维护记录，不当成随机故障分布。独立加载无Babylon依赖。
- [浏览器脚本](check-browser.cjs)/[原始结果](browser.json)/[摘要](browser.log)：Chrome155.0.8059.86，1280×800/DPR1，无缓存、无用户账户的临时独立上下文，仅托管生产dist。根及`/home/`检查默认时钟及太阳能实际推进、日夜导航/消耗、时间/设置/地图/失焦暂停、恢复不追赶、手动节点和刷新初态；原生界面操作及原共享时钟状态读数。零浏览器错误/告警/404；[根路径截图](menu-default.jpg)/[子路径截图](menu-subpath.jpg)已查看。
- 根及子路径各495文件GET、长度/SHA256通过，包括所有动态分包、来源/许可说明及清单；36素材和全部发布文件与子项目二步骤五一致。清单SHA256 `6af8f3b209acc7207ab7f0d6ae9a53adc821ec53b2d22feac09d5c24a9a214b3`，详见[发布清单](release-manifest.json)、[模块分析](bundle-analysis.json)及[最终证据复核](evidence-check.json)。

| 指标 | 原始字节 | 预算 |
| --- | ---: | ---: |
| 两个目标GLB | 4,332,840 | 4.25 MiB |
| 36个运行素材 | 15,867,377 | 16 MiB |
| 静态初始JS | 2,799,508 | 3 MiB |
| 实际首屏JS（含必要异步，根/子路径） | 3,018,360 | 3 MiB |
| 完整发布目录（495文件） | 42,463,991 | 41 MiB |

## 复跑与边界

1. 项目根目录执行`npm test`、`npm run typecheck`、`npm run build -- --output-path /private/tmp/lighthouse-weather-step1-development`、`npm run build:production`。本目录对应日志保存各命令输出，仅清理行尾空白与末尾空行。
2. 执行`node docs/technical-plans/assets/lighthouse-weather-step1-2026-10-21/check-models.cjs`。
3. 运行[serve-dist.cjs](serve-dist.cjs)，只映射最终dist到根和`/home/`，监听本机8253；设置`PLAYWRIGHT_PACKAGE`到可用`playwright-core`客户端，执行`check-browser.cjs`。本次使用`/private/tmp/dsh-playwright/node_modules/playwright-core`（1.64.1）和系统Chrome；不是新增项目或发布依赖。
4. 执行[verify-evidence.cjs](verify-evidence.cjs)核对代码摘要、重放/工程/浏览器记录、全发布清单及预算。Node24.21.0、TypeScript5.9.3、webpack5.111.1，实际版本随复核结果保存。

本轮没有天气GPU画面、实际隐患维修、发现缓存、版本2玩家存档迁移、平衡游玩、跨引擎/实机或FPS/加载速度结论。四流检查点仅验证随机原语恢复，完整会话恢复留步骤四。默认事件池仅两类可清洁表面，通用严重问题边界使用显式测试规则，未恢复备选玩家能力。后续桥接需将教学/到期污损及天气累积统一到真实设备，避免重复生成或双扣电。

本次提交目的为“完成灯塔天气风险子项目第一步”，通过本目录及方案Git历史定位；用户已有无关草稿目录未纳入提交。
