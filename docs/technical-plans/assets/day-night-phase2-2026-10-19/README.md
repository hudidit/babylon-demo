# 昼夜流转第二阶段验收（2026-10-19）

代码基线`ed703e8`，范围见[总方案](../../2026-10-19-day-night-cycle.md)第7.1/11节。八个节点通过`RoomScene.setTimeOfDay(hour)`立即驱动完整视觉状态；菜单、T键、平滑过渡与自动时钟属于第三阶段，本目录未把API夹具写成菜单验收。

## 交付内容与取舍

- 复用一盏室外方向光和一张1024²局部缓存阴影，白昼为太阳、夜间为弱月光；方向/位置同批更新，锚点切换保持当前天体。局部范围250/280世界单位、6米滞回，来源距离400、深度5～800，保留区域偏移，月影弱化反差。
- 天空球改为解析ShaderMaterial，与海面共用线性天空函数/时段参数；天空有同方向日月光盘，海面高光、底色、泡沫与雾同步变暗，晨昏远海雾按相同观察方向匹配天空。天空/海面均以世界位置减当前眼位求方向，镜面使用反射眼位；地平线暖色独立绑定连续太阳轨迹，避免日月交接时换向或突变。ACES/曝光1.12只处理一次线性结果。
- 原五盏房间窗光与阳台自然光按开口外法线接受当前日/月光，背光方向直射为零；室内半球/ambient与IBL分时段缩放。各材质保存原强度/反射色，重复选择不累乘，晚到家具继承当前时段；全局IBL仍0.35，人工灯/灯塔工作灯状态与暖色独立。真实镜面RTT和物品查看预览不做重复环境调色。
- `environment/coastal-daylight.hdr`保持原路径、替换为原创中性无太阳亮斑RGBE；[来源](../../../../public/textures/coastal/source.json)保存旧4444字节/`09c35ed0…22502`、新4190字节/`bd1b1c06…a231`及完整参数。`tools/generate-coastal-environment.py`使用Python标准库，可独立生成/`--check`；原全套处理脚本调用相同函数，六张扫描图没有重压，运行白名单路径未变。
- 单张低频IBL不模拟完整定向天空反射，原主卫小窗仍以间接光近似；20米灯塔晨昏约229米的全长投影超出当前局部图，未扩大整条路线或增加RTT。这些是当前美术/覆盖边界，不是已交付物理天文或全局光照。

## 工程与浏览器证据

- [tests.log](tests.log)、[typecheck.log](typecheck.log)、[开发构建](development-build.log)、[生产构建](production-build.log)：178测试全通过，新增6项联动/生命周期测试，更新原环境/HDR测试；pure独立进程检查保留。开发输出临时目录，生产自动发布校验通过。3条既有Webpack性能建议保留，未跳过或改阈值。
- [visuals.json](visuals.json) / [check-visuals.cjs](check-visuals.cjs)：Chrome155.0.8059.82关闭缓存，1280×800/DPR1，八节点×阳台/次卧窗/房外/步道/灯塔入口/小电驴共48图，另有4个天空光盘、4张晨昏交接对照及3张夜间灯光图。调用公开节点接口，姿态为固定相机夹具；连续小时交接用同一纯求值器向视觉适配器输入，覆盖日月均在地下的短暂区间，无旧日光/海面高光残留。正常错误/警告/404为零。
- [光盘方向像素检查](sky-alignment.json)、[晨昏连续性检查](twilight-continuity.json) / [只读分析脚本](check-sky-alignment.py)：四个光盘视角核心像素质心距期望中心最高0.144像素；晨昏交接前后各0.0001小时，同姿态天空/海面区域通道平均绝对差均低于0.04/255。使用本机bundled Python/Pillow，未修改图片；仅验证相邻求值结果，不等于第三阶段过渡/自动时钟已完成。
- [lifecycle.json](lifecycle.json) / [check-lifecycle.cjs](check-lifecycle.cjs)：持有书架请求、先切午夜再完成加载，书架及后建书本材质环境强度为各自基准×0.1；主动中止HDR后在0/12/06/21点切换均保持失败分量环境强度为零，其他天空/海面/场景可用。负向请求的预期网络错误单列，无未捕获异常；重复销毁通过。
- [原住宅回归](regression/regression.json)：复用[灯塔收尾回归](../lighthouse-finish-2026-10-19/check-regression.cjs)，输出独立目录，验证8抽屉/8灯/7门、55段房间路线、信件/地图/指针锁定/设置/拖动缩放/Inspector、家具失败隔离和释放。报告中历史`baseline`属于套件来源，本次输入为`ed703e8`加第二阶段代码，原历史证据未覆盖。
- 午夜双卫[主卫结果](mirrors/master/mirror-map.json)/[公卫结果](mirrors/public/public-mirror.json)，对应[主卫脚本](check-night-master-mirror.cjs)/[公卫脚本](check-night-public-mirror.cjs)：`timeAtStart=0`，真实RTT像素会随实际物体、门/灯和视点变化，恢复物体可恢复像素；主卫离屏/背面门控和两卫512²目标通过。镜面材质未被额外乘夜色。
- [journey.json](journey.json) / [夜间全路线脚本](check-night-journey.cjs)：`timeAtStart=0`，从住宅单次起点夹具后以真实按键经139控制点至塔、上下五层/每层离梯、32点外廊整圈、139点返回住宅；中途不修正人物位置或高度。固定50ms步长仅作功能参考，不测现实旅行时间、FPS或加载速度。地图/预设/设置/Esc恢复与梯中安全规则沿用原验收。
- [跨引擎矩阵](engines/matrix.json) / [check-matrix.cjs](check-matrix.cjs)：Chrome155.0.8059.82/WebKit27.2×DPR1/2×1280×800、390×844、844×390，共12组合、36图，默认12点的塔内/窗外/灯室、天空/海面可见材料、资源与释放通过。八节点/午夜真实键盘路线只计Chrome，矩阵不等于WebKit全部时段或物理设备。
- [subpath.json](subpath.json) / [check-subpath.cjs](check-subpath.cjs)：`/home/`时间切换、夜间地图回家、Inspector和JS前缀通过。首屏与必需异步合计12 JS，全部在子路径。
- [release-check.json](release-check.json) / [check-release.cjs](check-release.cjs)：根路径及`/home/`分别495文件全量GET/字节/SHA256通过，含未使用动态调试/编辑器分包、来源/许可与清单自身；除HDR之外35个运行文件逐字节不变。[完整发布清单](release-manifest.json)留档。

## 画面核对与校准

已查看主要节点、光盘、道路/台阶和室内灯开关画面；同姿态示例：[正午住宅](12-house.jpg)、[午夜住宅](00-house.jpg)、[清晨光盘/海面](06-sky-body.jpg)、[午夜光盘](00-sky-body.jpg)、[午夜步道](00-path.jpg)、[午夜灯塔入口](00-tower.jpg)、[全屋灯关闭的次卧](night-bedroom-all-lamps-off.jpg)、[塔内工作灯开启](night-maintenance-light-on.jpg)/[关闭](night-maintenance-light-off.jpg)。

最初夜景暗面偏低与晨昏海天接缝分别保存在[旧夜间候选](candidates/initial-night-path.jpg)、[旧清晨候选](candidates/initial-dawn-balcony.jpg)，均已替代，不是最终效果。00/03/21室外环境系数从设计初值0.060/0.045/0.080调至0.180/0.140/0.200；月光直接强度、室内系数、曝光不变。远海雾修正为同方向解析天空；最终对照为[步道](00-path.jpg)、[晨间阳台](06-balcony.jpg)。中性IBL保持近似边界，不从截图推断物理准确性。

## 资源统计

| 指标 | 第一阶段 | 第二阶段 | 差值 |
| --- | ---: | ---: | ---: |
| 静态初始 JS | 2,663,207 B | 2,669,051 B | +5,844 B |
| 实际首屏 JS，含必需异步 | 2,882,059 B / 12文件 | 2,887,903 B / 12文件 | +5,844 B |
| 下载运行素材 | 15,867,631 B / 36文件 | 15,867,377 B / 36文件 | −254 B，仅HDR |
| 两个目标GLB | 4,332,840 B | 4,332,840 B | 0 |
| 完整发布目录 | 42,286,617 B / 495文件 | 42,295,391 B / 495文件 | +8,774 B |

场景670网格/570,475顶点、95材质/148纹理/17灯/3相机均不变，未新增相机、RTT、下载数量或引擎能力。GLB≤4.25MiB、运行素材≤16MiB、静态/实际首屏JS≤3MiB、完整发布≤41MiB预算全部保持。

## 复跑与范围

`npm test`、`npm run typecheck`、`npm run build -- --output-path <临时目录>`、`npm run build:production`后，仅托管dist：`../coastal-cliff-d-2026-10-18/serve-dist.py --port 8194 --root <仓库绝对路径>/dist`。

本目录Node脚本使用`PLAYWRIGHT_PACKAGE=/private/tmp/dsh-playwright/node_modules/playwright-core`、`STUDY_URL=http://127.0.0.1:8194/`；矩阵另设`PLAYWRIGHT_WEBKIT_EXECUTABLE=/private/tmp/study-audio-test-browsers/webkit-2336/pw_run.sh`。这是本机工具路径，不是项目新依赖。镜面输出分别设`STUDY_CHECK_OUTPUT=<本目录>/mirrors/master`、`.../public`；原住宅回归输出设`.../regression`。其他脚本默认写当前验收目录，原灯塔历史验收未改写；浏览器与全量摘要检查按顺序执行。

不重新以本目录脚本覆盖后续版本基线；未来复验请改输出位置或建立新验收目录。Firefox/Safari/物理设备、主观实机听感、WebKit全部时间节点和午夜键盘路线未验；菜单、过渡及自动时钟待第三阶段，最终全平台整体收口待第四阶段。暂停的FPS/GPU/加载耗时实验继续暂停，不把字节、固定步长或图片写成性能收益。
