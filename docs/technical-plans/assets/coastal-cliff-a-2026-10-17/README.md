# 海边悬崖阶段A验收记录

2026-10-17，实施基线`0f834e5`，对应[海岸技术方案](../../2026-10-17-coastal-cliff-exterior.md)。本轮完成空间灰盒；精细PBR/日光和动态海面分别待B/C，最终整体收口待D。任务提交通过本目录Git历史查询。

## 交付与实际尺寸

- 原创程序地形、封闭分层崖壁/岩岬、房屋基座、静态海平面及顶点色天空；无新增下载模型、图片或室外HDR，室内材质/HDR/后期和八房安全边界保留。
- 主海岸宽78m，低精度内陆延伸600m；阳台中心到崖缘5m。房屋地坪、平台、海面分别为`-5/-5.7/-145`世界单位，1m=5单位；地坪到海面28m、平台到海面27.86m，崖底继续到地坪以下32m。
- 近岸平行列和直线内陆截面后的展开避免网格翻折；12,288个地表三角面朝向、房屋占地下支撑、崖缘/分区接缝及水下边界均有测试。基座与旧基础/地面重叠，完整侧视未见悬空。
- 阳台预设在阳台内约1.6m眼高向海，竖屏不退入室内；近距地形裁切与海面/天空/远景分开，距房屋中心50m以外恢复完整崖体，镜面裁切独立。

## 工程与发布

| 检查 | 结果 |
| --- | --- |
| 单元/资源/发布/失败路径 | [105项通过](tests.log)，含原通行/交互、安全边界及独立pure注册进程 |
| 类型检查 | [通过](typecheck.log) |
| 开发构建 | [通过](development-build.log)，输出临时目录，不覆盖生产包 |
| 生产构建及自动发布校验 | [通过](production-build.log)，Webpack原有三类建议告警保留 |
| 根路径及`/home/`独立托管 | [各487文件GET/字节/SHA256通过](release-check.json)，含所有动态分包、许可/来源及清单自身；无`public`补齐 |
| 运行素材保持情况 | [29个保留素材摘要不变](resource-changes.json)，森林两图退出运行发布，增加程序海岸来源说明 |
| 几何资源 | [前后计数与输入摘要](geometry.json)：室外9→14网格、139,655→26,739顶点、3→4材质、2→0纹理；灯/相机/额外目标均为0 |

[生产清单](release-manifest.json)与[初始分包分析](bundle-analysis.json)均保存完整副本。当前预算仍为两个目标GLB≤4.25MiB、运行素材≤16MiB、首屏JS≤3MiB、完整发布≤41MiB。

检查日志仅去除行末空白及多余尾部空行，保留诊断与检查结果。

| 指标 | 阶段A最终值 |
| --- | ---: |
| 两个目标GLB | 4,332,840字节（4.13MiB） |
| 29个运行素材 | 14,546,570字节（13.87MiB） |
| 静态初始JS | 2,534,008字节（2.42MiB） |
| 实际首屏12个JS，含必需异步/音频 | 2,752,860字节（2.63MiB） |
| 完整发布目录，487文件 | 40,846,327字节（38.95MiB） |

首屏统计方法：页面与音频就绪后、打开Inspector前，保存[浏览器实际观察到的资源URL](initial-browser-assets.json)，按最终`dist`文件逐项对应原始字节；计算过程见[统计记录](resource-changes.json)。12个JS及29个运行素材均被观察到。此为必要首屏资源集合/字节验收，未禁用浏览器缓存，不声称冷缓存HTTP传输量、加载速度或FPS改善。

## 浏览器与画面

[浏览器记录](browser.json)保存12个最终海岸取景的视图/状态/尺寸与手动检查方法；1280×800、390×844、844×390，DPR1。检查阳台面海、客厅透门望海、侧窗/后窗、全屋剖面、外部完整侧视；横移1m时近处门框和远处岩岬的移动幅度不同。推拉门可动作，设置、地图、Inspector可打开/返回；第一人称可进入/ESC恢复。最终记录无运行/着色器错误及浏览器告警。

- [阳台桌面](balcony-desktop.jpg)、[竖屏](balcony-portrait.jpg)、[横屏](balcony-landscape.jpg)。
- [客厅朝海](living-toward-sea.jpg)、[横移1m](living-shift-right-1m.jpg)、[推拉门动作](balcony-door-interaction.jpg)。平移使用Inspector将目标X从`-11`改为`-6`世界单位、保持轨道角度/半径不变，从而相机与目标共同平移1m；比较真实几何的视差，不用屏幕UV移动。
- [屋外完整侧视](exterior-side.jpg)，工程姿态通过Inspector临时设置，非新增产品预设；[姿态字段](external-camera.txt)记录目标`[0,-30,35]`、alpha45°/beta60°/radius400、上限600。退出调试并重选阳台即恢复正常镜头限制。
- [书房](study-desktop.jpg)、[主卧](master-desktop.jpg)、[次卧](bedroom-desktop.jpg)、[客厅](living-desktop.jpg)、[全屋](overview-desktop.jpg)。
- [子路径浏览器资源与就绪记录](subpath-browser.json)、[子路径阳台](subpath-balcony.jpg)：全部资源URL位于`/home/`，八房与音频就绪，最终无错误/告警。

内置浏览器未授予指针锁定，包括可见状态的原生点击；[第一人称进入画面](first-person-entry.jpg)和记录仅证明进入/拒绝锁定恢复/ESC退出。实际锁定漫游未复验，不能将键盘输入无位移写成已通行。原55段Chrome路线保留历史证据，原通行/碰撞单元测试本轮通过；DPR2、跨浏览器锁定漫游及B/C后完整回归留在D。辅助设置/地图/拒绝锁定检查在本轮早期执行，修复网格后重拍全部12个最终海岸取景并复验推拉门/Inspector/子路径；未修改对应交互实现。

当前画面是顶点色灰盒，不代表实拍材质、室外真实光照或动态海浪已完成。没有进行FPS、加载耗时、显存或GPU耗时测试；Inspector自带状态栏不作为性能验收样本。几何和字节减少不等于已验证的运行性能收益。

## 复现

```sh
npm test
npm run typecheck
npm run build -- --output-path /tmp/coastal-cliff-development
npm run build:production
python3 docs/technical-plans/assets/coastal-cliff-a-2026-10-17/serve-dist.py
```

另一个终端运行：

```sh
node docs/technical-plans/assets/coastal-cliff-a-2026-10-17/check-release.cjs
node docs/technical-plans/assets/coastal-cliff-a-2026-10-17/check-geometry.cjs
```

[托管器](serve-dist.py)只读取最终`dist`，`/home/`为同目录别名；[HTTP检查](check-release.cjs)逐文件核对，两张森林图片等未发布素材必须404。首次验收的12并发超出临时Python服务连接队列，改为3并发后通过；最终两路径各487文件均通过，不改页面或清单规避失败。[几何计数脚本](check-geometry.cjs)用NullEngine比较旧外景和本轮外景，输入摘要记录在`geometry.json`；计数不扩大为GPU/FPS实验。

浏览器取景使用Codex浏览器控制界面及Inspector数值字段，未新增场景运行依赖或生产测试入口。复用v1的机器清单/源码标签未覆盖；当前海岸不能冒充原森林稳定基线。
