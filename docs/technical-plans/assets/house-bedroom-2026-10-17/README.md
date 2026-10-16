# 阶段E：次卧实施验收

2026-10-17，代码基线 `8f5332b`，对应[新户型实施方案](../../2026-10-16-house-layout-implementation.md)阶段E。

## 实际交付

- [次卧布置](../../../../src/examples/HouseBedroom.ts)定位为客房兼阅读空间：1.5m床头靠北、1.8m三门衣柜靠东北，单床头柜与独立台灯、西窗下1.3×0.45m软垫阅读凳及书籍托盘。蓝灰织物/柜框、较小床宽、单侧床头柜和阅读凳区别于主卧绿色双人套间。
- 复用[卧室组件](../../../../src/examples/HouseRoomComponents.ts)，衣柜只增加可选饰面参数，默认主卧外观保持。木纹、亚麻、现有西窗窗帘/窗景和开关录音按场景复用，不新增模型、图片、程序贴图或依赖。柜门/床头柜为静态外观及碰撞，阶段E没有增加柜门或抽屉动画。
- 新增次卧日光和可点击台灯，受光/阴影归属隔离，灯光和灯罩发光独立开关；新增1024²/512²阴影目标。次卧观察预设包含剖面、地图高亮及竖屏退远，方向变化保留用户相对缩放。地图为五房ready、厨房/公卫/阳台三房shell；F/G仍待实施。

## 检查与证据

- [91项测试](tests.log)、[类型检查](typecheck.log)、[开发构建](development-build.log)、[生产构建/发布校验](production-build.log)通过。新增测试覆盖共享纹理对象、家具界内/落地、入口与床两侧/衣柜前双向真实碰撞通路、床柜/阅读凳阻挡、门扇21个开角无家具冲突、剖面、独立控灯、局部阴影失效、光源不被自身灯具挡住和阴影目标释放；响应式镜头测试加入次卧。
- [完整浏览器脚本](check-regression.cjs)及[结果](browser.json)通过：八抽屉、六灯、七门实际点击，六处室内门关阻挡/开双向通过，入户到阳台、套间/淋浴和次卧连续通路；原地图/信件模态互斥、Tab/ESC、指针锁定恢复、设置、拖动缩放和Inspector保持。第一人称实际点击次卧灯后直射光和发光同时归零，复用空间开关音效；再次点击恢复。
- 书架下载失败仍只将书房设为error，次卧及其他四间内容保持ready、三房shell；地图位置/高亮继续更新。重复pagehide后网格/材质/灯/引擎场景归零。正常流程无运行/着色器错误、404或浏览器告警；Webpack保留三类原有建议告警，失败注入单独记录。
- [横竖屏脚本](check-views.cjs)及[结果](views.json)覆盖390×844和844×390的次卧/主卧/主卫取景、地图高亮和控制栏边界。查看床品、木纹、柜缝、窗帘、阅读凳/托盘近景及家具落地，无穿墙或悬浮；西侧床边净走道约0.70m，南侧床尾净空约1.2m，东侧入口和衣柜前通行通过真实0.26m半径碰撞体校验。
- [地图/镜面回归脚本](check-map-mirror.cjs)及[结果](mirror-map.json)保持八房实际北向投影和四方向箭头一致；隐藏实景坐便器时反射变化5,123像素，恢复后SHA256完全还原，实际门/灯开关和观察位置改变倒影，背面/视锥外不刷新。仍为独立512²镜面、主画面prepass、3个运行相机。
- 仅托管最终dist，全部488文件（含全部动态分包、来源/许可说明、分析和清单自身）逐项GET/SHA256通过；[子路径脚本](check-subpath.cjs)及[结果](subpath.json)通过`/home/`验收。

画面：[次卧全景](bedroom.jpg)、[床与床头灯近景](bedroom-bed-close.jpg)、[衣柜近景](bedroom-wardrobe-close.jpg)、[阅读凳与窗帘](bedroom-seat-close.jpg)、[床头灯开启](bedroom-lamp-on.jpg)、[床头灯关闭](bedroom-lamp-off.jpg)、[竖屏](bedroom-portrait.jpg)、[横屏](bedroom-landscape.jpg)。

## 资源对照

详见[资源记录](resource-changes.json)、[发布清单](release-manifest.json)、[模块分析](bundle-analysis.json)及浏览器完整纹理名称/尺寸清单。

| 指标 | `8f5332b` | 阶段E | 预算 |
| --- | ---: | ---: | ---: |
| 30个运行素材 | 15,702,135字节 | 路径/字节/SHA256完全相同，14.97 MiB | ≤16 MiB |
| 两目标GLB | 4,332,840字节 | 完全相同，4.13 MiB | ≤4.25 MiB |
| 静态初始JS | 2,514,107字节 | 2,516,484字节 | ≤3 MiB |
| 实际首屏JS，含必需异步/音频预热 | 2,732,959字节 | 2,735,336字节，2.61 MiB | ≤3 MiB |
| 完整发布，含清单自身 | 41,980,517字节 | 41,983,092字节，40.04 MiB | ≤41 MiB |

最终539网格、367,940顶点、69材质、134纹理对象、11灯、3相机，分别增加21网格、13,695顶点、1个独立灯罩材质、2个阴影纹理对象、2灯。纹理清单与基线逐项对比，仅增加次卧两张阴影目标，七张原程序图的数量/尺寸不变（历史记录`book-paper`对应实际名称`paper-edges`），HTTP纹理URL无重复请求。总阴影图为2×2048、6×1024、2×512，主卫512²平面反射不变。静态/实际首屏JS各增加2,377字节，完整发布增加2,575字节；预算、白名单及依赖未变。

新增几何与阴影会增加渲染/GPU成本，显存未测；截图、固定delta和碰撞采样只用于功能/画面验收。本轮没有恢复FPS或加载耗时实验，既有亮屏性能/实机听感待验收事项仍保持原状态。

## 复现

```sh
npm test
npm run typecheck
npm run build -- --output-path /tmp/house-e-development
npm run build:production
python3 -m http.server 8113 --bind 127.0.0.1 --directory dist
```

另一个终端顺序运行本目录`check-regression.cjs`、`check-views.cjs`、`check-map-mirror.cjs`，指定`PLAYWRIGHT_PACKAGE=/path/to/playwright`、`STUDY_URL=http://127.0.0.1:8113/`和`STUDY_CHECK_OUTPUT=/tmp/house-e-check`，避免覆盖历史证据。使用只含`home -> 最终dist`的临时目录在8114端口托管，设置`STUDY_SUBPATH_URL=http://127.0.0.1:8114/home/`运行`check-subpath.cjs`。验收环境为本机Chrome/Playwright 1.62.1，DPR1。

代码、测试、来源说明、方案/索引/变更日志及本记录随“完成新户型阶段E次卧布置”提交推送，提交标识见Git历史。下一阶段F为厨房与公卫。
