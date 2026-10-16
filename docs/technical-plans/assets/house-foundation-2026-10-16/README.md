# 新户型阶段A：基础接口与旧双房回归

日期：2026-10-16。代码基线：`05ca8b0`（运行内容与`ab3368c`相同）。对应[实施方案](../../2026-10-16-house-layout-implementation.md)。本轮完成阶段A，阶段B～G未实施，没有生成八房结构或移动家具。

## 交付与边界

- [HouseLayout.ts](../../../../src/examples/HouseLayout.ts)：纯米制八房/八门数据、稳定ID、不可变定义、坐标转换和扣墙厚边界。SVG只消费布局；运行内容状态在注册表维护。
- [HouseRooms.ts](../../../../src/examples/HouseRooms.ts)：状态与布局版本、构建代次、晚到结果回收、共享所有权/逆序释放、清理异常诊断。现有场景明确标为`legacy-two-room`，目标为`house-plan-v1`，旧ready不能声称新户型已完成。
- [RoomMaterialLibrary.ts](../../../../src/examples/RoomMaterialLibrary.ts)按Scene复用共享材质/纹理；初始化失败只清理本次新增资源。房间只释放其自有几何/导入资源，不销毁其他房间的共享素材。
- 明确家具、层级节点、灯具和公共墙/门的`ownerRooms`，合并后保留归属；取消灯光的“非客厅就是书房”判断。旧共享墙芯用显式study受光配置保持原画面，双侧饰面各按自己的房间受光。
- 原动作ID不变；拒绝重复注册，按房间注销，共享动作保留至最后所有者释放。普通门的轴向/安装姿态通用化留到B，旧门运动/扫掠参数及眼高不变。

## 工程与浏览器

- [测试](tests.log)：73项通过，新增坐标/纯数据、代次与失败/重试、共享资源、异常清理、材质复用/初始化失败、交互ID冲突/注销及新房间不误用书房灯光测试。
- [类型检查](typecheck.log)、[开发构建](development-build.log)、[生产构建与自动发布校验](production-build.log)通过。开发输出使用临时目录，不覆盖最终dist。
- [基础生命周期脚本](check-foundation.cjs)及[结果](foundation-browser.json)：实际版本/房间状态正确，所有几何与内容节点都有归属；145网格、269,624顶点、64材质、6灯、3相机与基线一致。重复pagehide后网格/材质/灯光/引擎场景数清零。
- [完整原场景回归](regression-browser.json)：七个预设及近景、八抽屉、三灯、门开合/反向/动态碰撞/扫掠保护和双向通行、第一人称、拖动缩放、设置/Inspector。
- [地图回归](map-browser.json)：点击/M、横竖屏、Tab焦点、输入隔离、原姿态与鼠标锁定恢复/拒绝重试、两房语义高亮及重复开关清理；[信件回归](inspection-browser.json)覆盖模型共享、横竖屏与返回。
- 最终顺序运行无运行/着色器错误或404，构建保留三类既有Webpack建议告警。首次并行浏览器因本地静态服务器连接队列出现`ERR_CONNECTION_RESET`，改为顺序运行后通过，未修改资源路由或发布内容来绕过检查。

## 画面与交付记录

[全景](overview.jpg)、[书房](study.jpg)、[客厅](living.jpg)、[桌面](desk.jpg)、[门近景](door-first-person-context.jpg)、[地图大图](map-desktop.jpg)、[手机地图](map-portrait.jpg)、[信件详情](inspection-desktop.jpg)。历史画面对照见[上一阶段](../house-floor-plan-2026-10-16/README.md)和[音效阶段原场景回归](../interaction-audio-2026-10-16/regression/browser.json)。画面检查不等于FPS测量。

[前后字节记录](resource-changes.json)确认30个运行素材路径/字节/SHA256全部不变。静态JS2,490,407字节，实际首屏含异步及音频预热2,709,259字节（2.58 MiB），完整发布41,959,624字节（40.02 MiB）；JS增加7,164字节、完整发布增加7,510字节，预算未变。488个发布文件逐项GET/SHA256核验通过，包括完整动态分包及说明文件。[发布清单](release-manifest.json)和[模块分析](bundle-analysis.json)保留。

本轮未做FPS、CPU/GPU或加载耗时实验；原亮屏性能验收状态不变。浏览器范围为本机Chrome，未实测其他平台。生命周期接口与旧双房接入已完成，新户型的实际结构、通行和精确地图位置在B阶段实现。

## 复现

```sh
npm test
npm run typecheck
npm run build -- --output-path /tmp/house-stage-a-dev
npm run build:production
python3 -m http.server 8099 --bind 127.0.0.1 --directory dist
```

在另一个终端指定可用Playwright模块（本机1.62.1，使用Google Chrome），依次运行，避免并行浏览器压满开发静态服务器连接队列：

```sh
export PLAYWRIGHT_PACKAGE=/path/to/playwright
export STUDY_URL=http://127.0.0.1:8099/
node docs/technical-plans/assets/house-foundation-2026-10-16/check-foundation.cjs
STUDY_CHECK_OUTPUT=/tmp/house-stage-a-map node docs/technical-plans/assets/house-floor-plan-2026-10-16/check-map.cjs
STUDY_CHECK_OUTPUT=/tmp/house-stage-a-inspection node docs/technical-plans/assets/item-inspection-2026-10-16/check-inspection.cjs
STUDY_CHECK_OUTPUT=/tmp/house-stage-a-regression node docs/technical-plans/assets/painted-walls-2026-10-16/check-browser.cjs
```

后三个输出中的浏览器JSON与所列截图复制到本目录即可复核；其余临时回归截图不属于运行交付。
