# 灯塔剧情步骤四验收

状态：已完成（工程、Chrome生产尾声与根/子路径发布验收）。输入代码基线：`9b7af38`。对应[技术方案](../../2026-10-22-lighthouse-story-epilogue.md)。

## 检查入口

- [全量测试](tests.log)、[类型检查](typecheck.log)、[开发构建](development-build.log)、[生产构建和发布校验](production-build.log)。
- [实际生产尾声脚本](check-epilogue.cjs)、[浏览器结果](chapters-browser.json)、[运行日志](epilogue-browser.log)：固定场景编号0，从新故事实际完成三章后接入留站、夜间观察、核对和结尾；单独覆盖待回复/回复未读/结尾未看/结尾已看恢复、保存失败重试、原槽隔离及分包失败保护。
- [原功能与根/子路径发布脚本](check-regression.cjs)、[结果](regression.json)、[日志](regression.log)。
- [源码、清单、文档及证据一致性检查](check-evidence.cjs)、[检查结果](documentation-check.json)；[最终发布清单](release-manifest.json)、[依赖分析](bundle-analysis.json)。
- [真实流程的六个存档样本](checkpoint-samples.json)：第三章交接、留站登记、夜间观察前、待核对回复、结尾未看及已看。均由原模型及严格编码器保存，供检查恢复边界。

复现：先在项目根目录运行`npm test`、`npm run typecheck`、`npm run build`、`npm run build:production`，再依次运行本目录的`check-epilogue.cjs`、`check-regression.cjs`和`check-evidence.cjs`。浏览器脚本需要本机Chrome、`/private/tmp/dsh-playwright/node_modules/playwright-core`及回环监听权限；只托管最终`dist`，不从`public`补资源。脚本将结果写回本目录。提交的文本命令日志仅清理行尾空白，检查结果与数值保持。

## 方法与边界

页面按钮、任务/消息和等待均走生产代码。为缩短回归时间，设备位置使用落地相机/射线夹具，工作推进调用原共享时钟的0.1秒回执。正常路线不覆写电量、天气、问题、任务或观察事实；备用分支仅从已保存的真实夜间起点，用原电池模型构造200 Wh主电池/120 Wh备用电池初值，再通过原桥和编码器严格保存，用生产场景实际视线观察10秒。该受控低电分支单列记录，不冒充正常自然耗电路线。

覆盖1280×800、390×844、844×390、320×640的通知、夜间目标、旧呼号、正式回复、结束选择和结尾长记录。截图和几何定位不代表完整步行体验；未开展外部首次玩家/重玩节奏、长期天气平衡、实机、Firefox/Safari、FPS或加载耗时测量。其他引擎的既有天气验收保留历史范围，本轮按实际浏览器覆盖报告。

## 诊断保留

- [刷新后的书桌夹具诊断](attempts/desk-after-refresh/chapters-browser.json)：测试脚本把书桌位姿只留在页面变量中，刷新后变量消失。改为由脚本保留位姿并在使用时传入，未改游戏位置或存档协议。
- [备用站位门控诊断](attempts/backup-view-pose/chapters-browser.json)：旧站位未通过现场门控；改用现有几何测试中的2.8米外廊站位，最终射线首命中备用透光面、距离12.434米。门控与实体遮挡保持，未将失败候选计为通过。
- [结尾焦点诊断](attempts/ending-focus/chapters-browser.json)：通用隐藏控件回退覆盖了结尾标题焦点；将新页面焦点安排在回退之后，最终包重验。该目录的旧截图、脚本和结果是失败候选，不能视为最终验收。

## 最终结果

391项测试、类型及开发/生产构建通过。Chrome155.0.8059.86、DPR1完成19组流程/异常检查，44项故事与4项设备布局通过，另保存结尾滚动末尾和备用现场画面；原功能及根/子路径各496文件通过。剧情页面无错误/告警，原Inspector仍有1条样式弃用提示，webpack保留原3项体积建议。

首屏3,145,216 B（含全部必需异步，距3 MiB余512 B）；进入故事后另请求章节24,245 B。完整发布42,653,964 B，所有动态分包及说明均在496文件中。两目标GLB4,332,840 B、36项运行素材15,867,377 B逐文件保持。清单SHA256：`9cb8af79f12a0704aa4d83e38389f6f21101f3380658f786ac4edddc7affd2e4`。
