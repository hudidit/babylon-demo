# 阶段C：客厅与小书房迁移

2026-10-17，基线为阶段B `29548e4`；跨A～C资源对照基线为 `121ce91`。对应[实施方案](../../2026-10-16-house-layout-implementation.md)。B的独立结构记录见[上一阶段](../house-shell-2026-10-17/README.md)。

## 实现与边界

- [家具锚点](../../../../src/examples/HouseContent.ts)统一两房布置。书房是3×3.4m：北窗下1.66×1.2m书桌、单椅、东墙书架/藏书、台灯与信件；桌面约0.78m高。GLB按包围盒归一化，保留坐标系；书架/书本在最后一起旋转并冻结。
- 客厅是5.4×7.4m：北侧阅读双人沙发/扶手椅及小茶几，东侧主沙发/茶几/壁炉，西侧陈列柜/三抽屉边柜/古董柜，南侧保留阳台通口。落地灯与边柜已避让公卫出口。原四把重复座椅、脚凳/窗边凳、独立圆毯及小层板/时钟/古董柜顶饰未沿用旧摆法，保留全部原交互能力。
- 恢复八抽屉、三灯、信件和原连通门，七扇门两面可点。共享原音效和材料，灯光/阴影/相机按新位置配置。全景用矮墙剖面，近景随相机方向切前墙，挂画/窗口/顶线跟随支撑墙；第一人称恢复完整墙/顶，天花使用间接补光。HDR、SSAO与后期保留。
- 主卧、次卧、厨房、主卫、公卫、阳台仍为`基础结构`，地图显示真实位置/朝向及房间状态。阳台推拉门在G实施；入户门外与室外环境暂不开放。本轮没有生成这些房间的家具。

## 验收

- [81项测试](tests.log)、[类型检查](typecheck.log)、[开发构建](development-build.log)、[生产构建/自动发布校验](production-build.log)通过。测试覆盖最终家具/打开抽屉的房内包围盒、藏书随柜旋转、各门和连续动线的实际碰撞、灯位/遮罩及局部阴影失效、动态剖面/挂画、生命周期与既有细节。
- [Chrome脚本](check-content.cjs)和[最终结果](browser.json)：八抽屉、三灯、七门都用真实指针点击；六室内门关阻挡/开双向通过，入户区到阳台连续路径通过；七预设、地图/信件横竖屏、互斥/Tab/ESC/暂停底层输入/第一人称位置与锁定恢复、设置和Inspector通过。
- 空间音效验证迁移后的开关声源与交互网格世界位置、镜像Z的相机监听位置一致；上下文正常运行，仍为24声音对象共享12个原缓冲。不把音频图检查当作实机听感验收。
- 模拟书架下载失败，书房为error，客厅ready，其他六房shell，地图仍可用并提示刷新重试。异步状态刷新时地图保留位置/朝向和房间高亮，即使地图模态已暂停场景更新；重复pagehide后场景资源清零。最终正常流程无运行/着色器错误或404；失败注入单独记录。
- 仅托管正式dist，488文件逐项GET/SHA256通过，包含全部动态分包和说明文件。[子路径脚本](check-subpath.cjs)及[结果](subpath.json)确认`/home/`相对资源正常；内嵌纹理blob不被误当作HTTP发布路径。构建保留既有Webpack三类建议告警。

## 画面与资源

[全屋](overview.jpg)、[小书房](study.jpg)、[客厅](living.jpg)、[阅读区](reading.jpg)、[书桌](desk.jpg)、[桌面细节](details.jpg)、[古董柜](cabinet.jpg)、[入户第一人称](entry-first-person.jpg)、[书房近景](study-first-person.jpg)、[阳台通口](balcony-first-person.jpg)、[桌面地图](map-desktop.jpg)、[手机地图](map-portrait.jpg)、[横屏地图](map-landscape.jpg)、[信件](inspection-desktop.jpg)、[手机信件](inspection-portrait.jpg)。这些截图用于画面与交互检查，不是性能样本。

[资源对比](resource-changes.json)确认30个运行素材的路径、字节与SHA256全部不变：14.97 MiB，两个目标GLB为4.13 MiB。静态JS 2,497,666字节，实际首屏含必需异步/音频预热2,716,518字节（2.59 MiB），完整发布含清单41,967,491字节（40.02 MiB）；较A分别增加7,259/7,867字节。预算、白名单和依赖未变。[发布清单](release-manifest.json)、[模块分析](bundle-analysis.json)保留。

最终478网格、333,087顶点、60材质、128纹理对象、6灯、3相机，阴影图2×2048和3×1024。四张原动态图和三张磨损RawTexture按Scene共享，尺寸/数量未增加。几何增加是新房屋和门窗/饰面的代价，未做FPS、CPU/GPU或加载耗时实验，不从计数推断性能收益。

## 复现

```sh
npm test
npm run typecheck
npm run build -- --output-path /tmp/house-stage-c-dev
npm run build:production
python3 -m http.server 8101 --bind 127.0.0.1 --directory dist
```

另一个终端指定可用Playwright（本机1.62.1）后运行：

```sh
PLAYWRIGHT_PACKAGE=/path/to/playwright STUDY_URL=http://127.0.0.1:8101/ node docs/technical-plans/assets/house-content-2026-10-17/check-content.cjs
```

子路径验收在仅包含`home -> 最终dist`软链接的临时目录托管，然后指定`STUDY_SUBPATH_URL=http://127.0.0.1:8102/home/`运行`check-subpath.cjs`。脚本输出默认写本目录；回归可用`STUDY_CHECK_OUTPUT=/tmp/...`避免覆盖已保存记录。所有浏览器顺序运行，避免压满本地静态服务器连接队列。
