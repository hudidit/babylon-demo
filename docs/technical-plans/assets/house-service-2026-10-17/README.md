# 阶段F：厨房与公卫验收

2026-10-17，基线 `0c0d282`，对应[新户型方案](../../2026-10-16-house-layout-implementation.md)。保留该基线最新三维窗外森林。

## 交付与验证

- [厨房与公卫](../../../../src/examples/HouseServiceRooms.ts)：厨房北侧开放水槽/台面、东侧灶台/烟机/上下柜、西侧冰箱；公卫西侧洗手台/真实镜面、北侧坐便器、南侧2.7×0.9m淋浴，固定玻璃右侧1.08m入口。橱柜、电器、洁具为外观/碰撞，没有烹饪、流体或电器操作。复用既有材质/组件，新增共享钢材和两灯独立发光材质。
- 实际碰撞检查修正了靠墙台面间距及淋浴站位。原门底8mm间隙低于24mm以内的湿区饰面，统一改为30mm，门顶标高保持；所有原单开门回归通过。合并后的淋浴金属批次包围盒包含大量空白，门扫掠测试先作包围盒粗检，再检查实际三角形边交叉，避免将空白误判为实体碰撞。
- [96项测试](tests.log)、[类型检查](typecheck.log)、[开发构建](development-build.log)、[生产构建/发布校验](production-build.log)通过。覆盖家具界内/落地、纹理对象复用、厨房操作台/公卫干区/淋浴双向通路、实体阻挡、两门21个开角、独立控灯/阴影/自遮挡及双卫独立反射目标与释放。
- [完整浏览器回归](check-regression.cjs)/[结果](browser.json)：八抽屉、八灯、七门实际点击，六室内入口双向通行，厨房/公卫/卧室/淋浴及全屋通路；地图/信件、设置/Inspector、指针锁定恢复、失败隔离和重复销毁通过。七房ready，阳台shell；书架失败只影响书房。正常流程无运行/着色器错误、404或浏览器告警；Webpack保留三类既有建议告警。
- [公卫镜面实物检查](check-public-mirror.cjs)/[结果](public-mirror.json)：同镜头隐藏实际坐便器改变2,088个反射像素，恢复后SHA256一致，实际关闭镜前灯改变倒影。两卫均使用独立512²反射、无额外镜面prepass和新增相机。原主卫和北向地图的[回归](check-map-mirror.cjs)/[结果](mirror-map.json)通过。
- [横竖屏](check-views.cjs)/[结果](views.json)检查厨房、公卫和卧室取景/地图高亮/控制栏，近景检查开放水槽、柜体、台面、玻璃、洁具、灯光和接触关系。全部489发布文件逐项独立dist托管GET/SHA256及[子路径](subpath.json)通过，包含全部分包和说明文件。

画面：[厨房](kitchen.jpg)、[水槽](kitchen-sink-close.jpg)、[灶台](kitchen-cooker-close.jpg)、[公卫](bathroom.jpg)、[洗手台](bathroom-vanity-close.jpg)、[淋浴](bathroom-shower-close.jpg)、[公卫真实倒影](public-mirror-front.jpg)、[关灯倒影](public-mirror-light-off.jpg)、[厨房竖屏](kitchen-portrait.jpg)、[公卫竖屏](bathroom-portrait.jpg)。

## 资源

[资源对照](resource-changes.json)、[发布清单](release-manifest.json)、[模块分析](bundle-analysis.json)保存。31个运行素材路径/字节/SHA256完全不变，共16,457,409字节（15.70 MiB）；两目标GLB仍4,332,840字节（4.13 MiB）。静态初始JS2,526,259字节，实际含必需异步/音频预热2,745,111字节（2.62 MiB），完整发布含清单42,749,796字节（40.77 MiB），预算/白名单/依赖不变。

588网格、524,455顶点、76材质、139纹理对象、14灯、3相机，较基线增加40网格、12,972顶点、4材质、4纹理对象、3灯；新增阴影1024²/512²/1024²和一个512²镜面目标，原七张程序图、森林素材不变。新增GPU绘制/附件成本与下载体积分开记录，显存未测，不恢复FPS或加载耗时实验。

## 复现

运行`npm test`、`npm run typecheck`、`npm run build -- --output-path /tmp/house-f-development`、`npm run build:production`，仅以最终dist启动静态服务器。使用本机Playwright包设置`PLAYWRIGHT_PACKAGE`及`STUDY_URL=http://127.0.0.1:8113/`，顺序运行本目录五个`check-*.cjs`；子路径脚本使用`STUDY_SUBPATH_URL=http://127.0.0.1:8114/home/`，该服务器仅托管`home -> 最终dist`软链接。可用`STUDY_CHECK_OUTPUT=/tmp/house-f-check`保护历史证据。浏览器固定delta仅用于功能检查，Chrome版本见JSON，DPR1。

阶段F代码/方案/记录随“完成新户型阶段F厨房与公卫”提交推送，标识见Git历史；G继续完成阳台和全屋收尾。
