# 阶段B：八房结构与漫游

2026-10-17，基线 `121ce91`。对应[实施方案](../../2026-10-16-house-layout-implementation.md)。

- 新运行布局为 `house-plan-v1`。八房地面、去重墙段、门窗洞、七扇单开门、天花、阳台栏杆/安全碰撞已生成。入户直达客厅，主卫仅经主卧；本阶段全部房间标为基础结构。阳台推拉门留在G。
- 固定安装节点与局部门运动分开，扫掠使用安装坐标/实际玩家半径；只刷新受影响房间阴影。第一人称眼高1.6m，半径0.26m，末端保护处理阳台凹角。环绕剖面只改变可见性。
- 地图使用真实坐标和朝向。旧双房几何只供历史细节测试，运行入口不构建它。
- [77项测试](tests.log)、类型检查、[开发构建](development-build.log)、[生产构建/发布校验](production-build.log)通过。实际碰撞测试覆盖每个室内门关闭阻挡/打开双向通行、横纵安装和扫掠保护、阳台通口、剖面状态、外围与入户边界。
- [Chrome脚本](check-shell.cjs)及[结果](foundation-browser.json)：版本、八房shell状态、全部节点归属、地图及释放检查通过；251网格、184,268顶点、48材质、6灯、3相机。重复pagehide资源清零。独立托管488文件GET/SHA256通过，实际首屏JS含音频预热2,695,102字节，完整发布41,958,461字节，全部预算满足、素材未变。
- [全屋结构](shell-overview.jpg)、[地图](shell-map.jpg)。本阶段为结构过渡，家具恢复由紧接的C完成。本轮未做FPS或加载耗时实验。

阶段B复现需使用该阶段提交 `29548e4`；当前分支已由C推进。复现：`npm test`、`npm run typecheck`、`npm run build -- --output-path /tmp/house-stage-b-dev`、`npm run build:production`；托管dist后指定 `PLAYWRIGHT_PACKAGE`、`STUDY_URL` 运行 `node docs/technical-plans/assets/house-shell-2026-10-17/check-shell.cjs`。
