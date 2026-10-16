# 地图方向与主卫镜面修复验收

2026-10-17，基线为阶段D `db500b3`，对应[修正方案](../../2026-10-17-map-and-bathroom-mirror-fix.md)。旧地图和HDR镜面截图见[阶段D记录](../house-suite-2026-10-17/README.md)，本记录替代其镜面取舍。

## 实现

- [HouseFloorPlan](../../../../src/examples/HouseFloorPlan.ts)采用Babylon左手系北向俯视投影：世界-X朝屏幕右方，世界-Z朝上。大小地图共同转换房间矩形、门洞/扫掠符号、位置与朝向；文字和尺寸保持正向，公卫标签避开镜像后的门弧。规划数据、房屋世界坐标、家具、碰撞及门开向均未改变。HTML地图说明同步，不以旋转观察镜头掩盖左右镜像。
- [RoomMirrors](../../../../src/examples/RoomMirrors.ts)为镜片安装独立512²动态平面反射材质/目标，平面由[洗手台组件](../../../../src/examples/HouseRoomComponents.ts)最终世界变换及镜片正面取得。绘制主卫和直接连接的主卧，镜面、预览层和纯碰撞网格不入列表；门墙保留实际遮挡。剖面渲染时仅临时恢复列表内结构的显隐，结束后还原，不强行显示用户隐藏的家具。
- 镜面每次可见正面更新，背面/视锥外保留缓存。复用已有相机的反射视图矩阵，不新增Camera。每块镜片拥有自己的材质/目标，销毁网格时释放并注销观察器；普通洁具/木纹/织物继续共享。第一人称没有角色模型，因此镜中无玩家实体。
- 镜面仅使用颜色/深度目标，不复制主画面的SSAO MRT；设置`noPrePassRenderer`前后的固定镜头镜面摘要完全一致，目标资源收口由5个新增纹理对象降到1个，详见[prepass对照](prepass-comparison.json)。主画面`sceneprePassRT`仍存在，原SSAO、HDR环境照明和后期保持。此处是资源对象证据，不是FPS收益。

## 功能与画面验证

- [88项测试](tests.log)、[类型检查](typecheck.log)、[开发构建](development-build.log)、[生产构建及发布校验](production-build.log)通过。新增两项地图测试以真实左手相机矩阵投影验证八房左右/上下，以及四方向箭头；镜面测试覆盖世界平面/裁切侧、两卫独立材质/目标、局部房间列表/排除自身、剖面恢复及释放。独立pure进程验证镜面注册、材质克隆及渲染，不依赖总入口提前注册。
- [专项脚本](check-map-mirror.cjs)、[结果](mirror-map.json)：浏览器创建临时北向正交相机，仅用于对照八房实际地面中心；大小地图左右/上下关系与投影一致，四方向箭头正确，文字可读；横竖屏地图/主卫预设通过，专项相机当场销毁，运行相机仍为3个。
- 正视镜面确实出现主卫窗、玻璃、坐便器和门。相同镜头隐藏实景坐便器，反射目标有5,123像素变化；恢复后完整SHA256回到原值。实际点击主卫门开合及镜前灯开关，固定镜头倒影摘要改变；改变观察位置也产生不同倒影。背向/视锥外再渲染8帧，镜面渲染计数不增加。像素来自镜面目标绑定期间的帧缓冲读回，未为QA给运行入口新增读纹理模块。
- [完整回归脚本](check-regression.cjs)、[结果](browser.json)保留八抽屉、五灯、七门实际点击，六处室内门关阻挡/开双向通过、入户到阳台及套间/淋浴通路、设置/拖动缩放、Inspector、地图/信件模态/横竖屏/互斥/Tab/ESC/指针锁定恢复；八房地图定位按修正后的投影核验。书架下载失败仍仅书房error，其余房间/地图可用；重复pagehide清空场景网格、材质、灯和引擎场景。
- 正常浏览器流程无运行/着色器错误、404或告警；Webpack保留三类原有体积/缓存建议告警。全部488发布文件含懒加载调试分包、许可/来源说明和清单，逐项独立托管GET/SHA256通过；[子路径脚本](check-subpath.cjs)及[结果](subpath.json)通过`/home/`验收。失败注入单独记录。

画面：[全屋/小地图](overview.jpg)、[大地图](map-desktop.jpg)、[竖屏地图](map-portrait.jpg)、[横屏地图](map-landscape.jpg)、[镜面正视](mirror-front.jpg)、[门打开的倒影](mirror-door-open.jpg)、[另一位置的倒影](mirror-other-view.jpg)、[关灯倒影](mirror-light-off.jpg)、[主卫竖屏](ensuite-portrait.jpg)、[主卫横屏](ensuite-landscape.jpg)。截图及固定delta只用于功能/画面验收，不是性能样本。

## 资源

[对照记录](resource-changes.json)、[发布清单](release-manifest.json)、[模块分析](bundle-analysis.json)保留。30个运行素材的路径、字节和SHA256完全不变，共15,702,135字节（14.97 MiB）；两个目标GLB保持4,332,840字节（4.13 MiB）。静态初始JS为2,514,107字节，实际首屏含必需异步/音频预热为2,732,959字节（2.61 MiB），均较D增加6,857字节。完整发布含清单为41,980,517字节（40.04 MiB），增加2,807字节。未修改预算、白名单或依赖。

518网格、354,245顶点、9灯、3相机及8张阴影目标不变；材质67→68、纹理对象131→132，新增一张512²平面反射目标。纹理名称/尺寸清单保存在浏览器结果，主画面prepass仍存在而镜面无附加prepass目标。原七张程序图尺寸/数量不变。实时反射在可见时增加一次局部场景绘制和颜色/深度附件，不能把下载资源不变当作GPU成本不变；没有测显存、FPS或加载耗时。

## 复现

```sh
npm test
npm run typecheck
npm run build -- --output-path /tmp/map-mirror-dev
npm run build:production
python3 -m http.server 8113 --bind 127.0.0.1 --directory dist
```

使用本机可用Playwright包（验收1.62.1）在另一个终端顺序运行`check-map-mirror.cjs`、`check-regression.cjs`，指定`PLAYWRIGHT_PACKAGE=/path/to/playwright`和`STUDY_URL=http://127.0.0.1:8113/`。`check-subpath.cjs`使用只含`home -> 最终dist`软链接的临时目录托管，指定`STUDY_SUBPATH_URL=http://127.0.0.1:8114/home/`。可设置`STUDY_CHECK_OUTPUT=/tmp/...`保护已保存记录。

代码、修正方案、索引/变更日志、来源说明及证据随“修复地图左右投影与主卫实时镜面”提交推送，标识见Git历史。E～G及既有亮屏性能/实机听感事项保持原状态。
