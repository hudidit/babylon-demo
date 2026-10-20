# 灯塔子项目二步骤三：能量与补能验收

日期：2026-10-20。代码基线`9e3823e`；最终17套同包验收通过。完整电池、太阳能、机组和燃料实现与取舍见[技术方案](../../2026-10-20-lighthouse-project-02-equipment-and-maintenance.md#步骤三实施约定2026-10-20)。

## 复跑与方法

先执行`npm test`、`npm run typecheck`、`npm run build`，最后`npm run build:production`。仅托管最终`dist`，可使用[独立服务器](../coastal-cliff-d-2026-10-18/serve-dist.py)的`--port 8241`；启动时必须已有生产清单。设置可用的`PLAYWRIGHT_PACKAGE`及`PLAYWRIGHT_WEBKIT_EXECUTABLE`后运行：

```sh
node docs/technical-plans/assets/lighthouse-equipment-step3-2026-10-20/run-checks.cjs
node docs/technical-plans/assets/lighthouse-equipment-step3-2026-10-20/verify-evidence.cjs
```

[统一入口](run-checks.cjs)包含17套；结果/脚本/适配器和发布清单分别绑定SHA256。可指定套件名复跑同一包的对应项；生产包变化须另建记录，不得拼接旧包通过项。

- [补能浏览器](check-power.cjs)：从首层实际点击独立“21点/11%”教学工况，T键开启自动流转，点击画面恢复原生指针锁。仅使用合法附近落地站位和原生产`updateTimeOfDay(.1)`有界凭据推进，真实消耗到10%并保持备用；机房实际启动、停机补给/中断、回充20%仍锁存、错误工具拒绝、电池复验、机组独立净Wh采样、燃料耗尽与不能空箱启动；退出逐值恢复原正常会话。没有直接写电量/燃料/故障/证据。
- [三条维修演练](check-drills.cjs)沿用步骤二真实点击/工具/遮挡/完整试机与清洁GPU反馈，充电改为开启自动流转后的真实主电池Wh采样，故障或负趋势不通过；正常会话的原试灯余时、时刻、Wh、燃料/储备及日志均恢复。
- 原设备、住宅往返139+139段、五层/外廊巡检、住宅门灯帘/双卫反射/车灯回归、双引擎72个设备GPU对比和三轮应用重建继续执行。重建逐轮检查15个维护命令及5个补能命令，销毁后节点/监听与渲染资源释放。
- 根/子路径每个发布文件GET、字节及SHA256逐项核对，36运行素材与步骤二比较保持；首屏含必需异步JS，完整发布包含全部动态分包与说明。

参考推进只检验功能。它不测量FPS、加载时间、GPU耗时或真实航海射程；多日压力及跨平台完整驾驶不由本步结论代替。Chrome用于完整操作，WebKit用于设备GPU矩阵；Firefox/Safari/物理设备本步未重验。

## 过程记录

[attempts](attempts/)保留原生指针锁下不能直接点击时间按钮、收起菜单需要重新点击画面等夹具诊断。`natural-depletion-preqa/`保存前一生产包从80%真实消耗到第4日保护、补给回充/燃料耗尽以及三条维修演练的成功原始返回；其完整发布清单未归档，不能作为最终同包验收或多日压力通过。该参考流程已完成，新增教学工况后重新构建并复验全部套件，预验返回仅供诊断参考。

新增11%教学工况用于便捷体验，不改变正常80%初值。能量模型补充空电池日出输入低于5W控制负载时不得通过帧步长产生短暂存能的测试。`pre-availability-label/`保存17套预验通过的汇总及原生产清单；最终核对补上备用耗尽明确显示不可用后，重新构建并重跑全部套件，以下交付证据只使用最终包。

## 最终结果

工程[263测试](tests.log)、[类型检查](typecheck.log)、[开发构建](development-build.log)与[生产构建/自动发布校验](production-build.log)通过，生产构建保留3条webpack默认体积建议，硬预算未调整。Node24.21.0、TypeScript5.9.3、webpack5.111.1、Babylon9.30.0、Playwright1.64.1；Chrome155.0.8059.85完成操作与原功能回归，WebKit27.2完成设备GPU矩阵，均使用本机无头浏览器。

[17套汇总](run-checks.json)全部通过：根/子路径[补能](power/power.json)/[子路径补能](power-subpath/power.json)、[三条维修演练](drills/drills.json)/[子路径演练](drills-subpath/drills.json)、八类设备及三视口键盘/暂停、原完整巡检/住宅往返139+139段/五层和外廊、住宅门灯帘/双卫反射/车辆车灯、三轮应用重建释放、双引擎72个设备GPU对比，以及[各495个发布文件GET/摘要](release.json)。补能从11%真实消耗316个有界帧触发10%保护，回充20%仍需检测；补给中断不扣、正确补给一次扣4单位、机组实际Wh采样/耗尽停机、退出逐值恢复和销毁均通过。采集无运行/着色器错误、404或警告。

[最终生产清单](release-manifest.json)SHA256：`8384ba5846c005ef1c26ce10a40bead2fae4c3ff33256db537d740c1b72774e3`。[依赖分析](bundle-analysis.json)及[证据复核](evidence-check.json)记录全部脚本、结果和运行源文件摘要，只使用本包结果。

| 指标 | 步骤二`9e3823e` | 本步最终包 | 硬预算 |
| --- | ---: | ---: | ---: |
| 两目标GLB | 4,332,840 B | 4,332,840 B | 4.25 MiB |
| 运行素材（36文件） | 15,867,377 B | 15,867,377 B | 16 MiB |
| 静态初始JS | 2,772,592 B | 2,790,142 B | 3 MiB |
| 根/子路径首屏JS，含必需异步 | 2,991,444 B | 3,008,994 B | 3 MiB |
| 额外工具早到窗口，保守计入 | 2,994,767 B | 3,012,317 B | 3 MiB |
| 完整发布（495文件，含清单） | 42,424,373 B | 42,444,702 B | 41 MiB |

首屏增加17,550 B、完整发布增加20,329 B。设备仍24网格/1,588顶点/3种新增材质/1张256×512图集，场景仍717网格/576,812顶点/106材质/153纹理/22灯/3相机；没有新增下载、几何、材质、灯、相机、RTT、阴影目标或连续音频。字节与参考推进不证明加载速度或FPS收益。

代表画面：[低电保护](power/battery-low-protection.jpg)、[20%待检测](power/battery-recovery-awaits-verification.jpg)、[机组实际回充](power/generator-output-verified.jpg)、[燃料耗尽](power/generator-fuel-empty.jpg)。Firefox/Safari/物理设备、主观听感及连续多日压力未重验；维护到期、持久库存及本地保存仍属于步骤四，多日综合属于步骤五。
