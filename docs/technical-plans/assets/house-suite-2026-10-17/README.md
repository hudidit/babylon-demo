# 阶段D：主卧与主卫

2026-10-17，代码基线为阶段C `5689610`，对应[新户型实施方案](../../2026-10-16-house-layout-implementation.md)。历史两房基线见[阶段C记录](../house-content-2026-10-17/README.md)。

## 交付与取舍

- [共享卧室/卫浴builder](../../../../src/examples/HouseRoomComponents.ts)以房间局部米制锚点建模，在组件边界统一换算；床宽、衣柜/洗手台宽度、淋浴尺寸及朝向可配置，已用次卧/公卫的第二组实例验证材质和纹理共享，不在运行场景提前布置E/F。
- [套间布置](../../../../src/examples/HouseSuite.ts)：主卧1.8m双人床、软包床头、被褥/抱枕、双床头柜、2.6m衣柜、地毯/书杯和可点击床头灯；保留原北窗、窗景及窗帘。主卫0.82m洗手台/开放盆/水龙头、坐便器、支撑镜框/镜前灯、瓷砖勾缝、2.18×0.9m淋浴、地漏/花洒及固定玻璃。
- 淋浴右侧开口1.08m，洗手台缩窄并北移，避免门口到湿区转弯夹缝。玻璃为双面透明、保留真实碰撞且不投不透明阴影，步入地面低于碰撞体足底。主卫仍只经主卧到达，未增加通公卫/客厅的门。
- 人工灯各自控制直射光与独立发光材质，复用既有开关声音。发射点置于灯壳外，遮罩及阴影缓存按房间隔离。新增主卧日光1024²、床头灯512²、镜前灯1024²阴影目标；没有给全部装饰复制一套灯图。
- 镜面是共享HDR的环境反射，不显示实时房间/人物倒影；不新增平面反射相机、渲染目标、图片或模型。床头柜/衣柜/洁具为外观与碰撞组件，没有柜门、出水和冲洗动画。四间内容完成、次卧/厨房/公卫/阳台仍为shell；阳台推拉门留给G。

## 验收

- [85项测试](tests.log)、[类型检查](typecheck.log)、[开发构建](development-build.log)、[生产构建及自动发布校验](production-build.log)通过。新增4项套间回归覆盖最终房内包围盒/落地、两卧双卫组件复用不重复纹理、连续通行和真实障碍、两门全角度采样扫掠、剖面保留玻璃碰撞、灯光状态/材质/受光房间/阴影失效隔离及发射点不被自身外壳遮挡。
- [完整Chrome脚本](check-suite.cjs)与[结果](browser.json)：八抽屉、五灯、七门都实际点击，六处室内门关阻挡/开双向通过；保留入户→阳台连续通路，新增客厅→主卧→主卫→淋浴、衣柜前/床两侧路线。玻璃、床、衣柜及主卫/公卫分隔墙实际阻挡；碰撞出口容差0.03场景单位（6mm），与几何测试一致，原门测试保持原容差。
- 九个环绕预设/剖面与地图房间归属、第一人称地图位置/方向、地图与信件横竖屏/互斥/Tab/ESC/底层输入暂停/锁定恢复、设置/拖动缩放及按需Inspector通过。主卫第一人称点击镜前灯产生空间开关声，并真实关闭该房灯光；原客厅声音网格/监听位置、24声音对象共享12缓冲的检查仍通过。音频图/事件不替代实机听感。
- 模拟书架下载失败仅书房error，客厅及套间可用；地图打开期间的异步状态刷新仍保留定位/高亮，无未捕获异常。重复pagehide后场景网格、材质、灯及引擎场景数为零。
- [补充视图脚本](check-suite-views.cjs)和[结果](views.json)检查390×844竖屏/844×390横屏的两房预设、按钮可达和地图高亮；竖屏按宽高比退远取景，方向切换保留用户相对缩放，并保存淋浴硬件第一人称近景。
- 最终dist独立托管488个文件逐项GET/SHA256通过，包含全部动态调试分包、来源/许可说明、分析和清单；[子路径脚本](check-subpath.cjs)及[结果](subpath.json)验证`/home/`相对资源和四房ready状态。正常流程没有运行/着色器错误、404或浏览器告警；构建保留原Webpack三类体积/缓存建议告警。失败注入与正常流程分开记录。

## 画面与资源

[全屋](overview.jpg)、[主卧](master.jpg)、[主卫](ensuite.jpg)、[床近景](master-bed-close.jpg)、[衣柜近景](master-wardrobe-close.jpg)、[洗手台/环境镜面](ensuite-vanity-close.jpg)、[淋浴/玻璃及花洒](ensuite-shower-hardware.jpg)、[主卫关闭人工灯](ensuite-light-off.jpg)、[主卧竖屏](master-portrait.jpg)、[主卫竖屏](ensuite-portrait.jpg)、[主卧横屏](master-landscape.jpg)、[主卫横屏](ensuite-landscape.jpg)。其他已保存视角用于原功能回归，截图不作为FPS或加载速度样本。

[资源对比](resource-changes.json)确认30个运行素材的路径、字节、SHA256与C完全一致：15,702,135字节（14.97 MiB），两个目标GLB为4,332,840字节（4.13 MiB）。静态初始JS为2,507,250字节；实际首屏包含必需异步及音频预热为2,726,102字节（2.60 MiB），各增加9,584字节。完整发布含清单自身为41,977,710字节（40.03 MiB），增加10,219字节。原16/4.25/3/41 MiB预算、白名单和依赖不变；来源说明新增原创程序组件的说明。保存[发布清单](release-manifest.json)与[模块分析](bundle-analysis.json)。

最终518网格、354,245顶点、67材质、131纹理对象、9灯、3相机；较C增加40网格、21,158顶点、7材质、3纹理对象、3灯。原七张程序纹理尺寸/数量不变，阴影目标由5张增加至8张（2×2048²、5×1024²、1×512²）；实际内存/显存未测，增加的目标成本不能用下载字节不变掩盖。没有新增实时镜面目标，不恢复既有暂停的FPS、CPU/GPU或加载耗时实验，不从计数推断性能收益。

## 复现

```sh
npm test
npm run typecheck
npm run build -- --output-path /tmp/house-stage-d-dev
npm run build:production
python3 -m http.server 8113 --bind 127.0.0.1 --directory dist
```

另一个终端使用可用的Playwright包（本机1.62.1）顺序运行：

```sh
PLAYWRIGHT_PACKAGE=/path/to/playwright STUDY_URL=http://127.0.0.1:8113/ node docs/technical-plans/assets/house-suite-2026-10-17/check-suite.cjs
PLAYWRIGHT_PACKAGE=/path/to/playwright STUDY_URL=http://127.0.0.1:8113/ node docs/technical-plans/assets/house-suite-2026-10-17/check-suite-views.cjs
```

子路径验收在仅含`home -> 最终dist`软链接的临时目录托管，通过`STUDY_SUBPATH_URL=http://127.0.0.1:8114/home/`运行`check-subpath.cjs`。脚本输出默认写本目录，可设置`STUDY_CHECK_OUTPUT=/tmp/...`保留原记录。浏览器顺序运行，避免本地静态服务连接队列受并发影响。

D的代码、测试、说明和证据随“完成新户型阶段D主卧与主卫布置”提交推送，提交标识见Git历史。后续按E→F→G继续，既有亮屏性能与跨平台主观音效验收保持待完成。
