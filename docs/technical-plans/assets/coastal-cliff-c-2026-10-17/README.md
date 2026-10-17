# 海岸阶段C：动态海面验收

日期：2026-10-17。代码基线为阶段B `98e760a`，本记录随“完成海边悬崖阶段C动态海面”提交交付。[主方案](../../2026-10-17-coastal-cliff-exterior.md)的A/B/C已完成，D最终多平台整体验收待实施。

## 实现与画面

[海面模块](../../../../src/examples/CoastalOcean.ts)替换静态占位，保留共享室外接口、室内HDR/灯光/ACES、碰撞/拾取及原交互。

- 固定世界坐标的近密远疏网格，3组解析位移波与3层不同方向/速度的梯度细浪法线；几何波在100～220m淡出，细浪按像素足迹/距离过滤。第一轮周期性细浪造成条纹/规则高光点阵，最终换为旋转梯度噪声。最终[阳台](balcony-desktop.jpg)、[太阳高光](sun-glint.jpg)、[低角度掠海](sea-grazing.jpg)保留波面层次，海天雾带遮住有限海面外缘。
- 菲涅耳与粗糙GGX太阳高光读取共享解析天空方向/颜色，输出线性颜色，由既有后期应用ACES和曝光。海面使用独立ShaderMaterial；启动图中显式保留裁切include，不异步加载水面图片/着色器文件。镜面使用反射眼位置和独立`clipPlane`，近陆`clipPlane2`不裁海。
- 实际崖壁7/8环在平均海面的截面生成闭合岸线，256²线性RGBA8场保存16位有符号距离及静态坡形水深近似；同一场控制水色和约3m宽的破碎推进泡沫。[崖脚近景](shore-close.jpg)、[外部侧视](exterior-side.jpg)检查水岩贴合，无新增水面图片或反射/折射RTT。
- [阶段B同镜头](before-balcony.jpg)与[阶段C](balcony-desktop.jpg)可比较。客厅[望海](living-toward-sea.jpg)/[横移1m](living-shift-right-1m.jpg)、阳台[左侧](balcony-left.jpg)/[右侧](balcony-right.jpg)/[低头](balcony-look-down.jpg)、8房及全景均保存最终截图。工程侧视与崖脚镜头在50m近陆剖切范围外；取景先等待PBR裁切变体异步编译稳定，避免把未就绪的旧裁切误判成地形缺口。

动态效果保存20帧海面和12帧崖脚泡沫，每帧推进0.2秒动画时间，分别组成[海面动画](ocean-animation.webp)、[泡沫动画](shore-animation.webp)，可用[海面四帧](ocean-animation-sequence.jpg)/[泡沫四帧](shore-animation-sequence.jpg)逐帧比较。[像素检查](animation-check.json)记录首尾变化区域；这是画面验证，固定delta与截图采样不代表实际渲染FPS或加载速度，也不自动证明所有设备均无闪烁。本轮连续画面人工复核未见远海高频闪烁/摩尔纹，保留实际其他平台验收在D。

## 工程、生命周期与浏览器

115项测试、类型检查、临时目录开发构建、生产构建与发布校验通过；见[测试](tests.log)、[类型](typecheck.log)、[开发构建](development-build.log)、[生产构建](production-build.log)。保留Webpack的3项体积/分包提示，项目自身预算及初始模块限制通过。独立pure进程不使用core总入口预热，检查自定义海面、RawTexture及启动裁切include；实际GLSL编译由生产WebGL浏览器验证。

[浏览器记录](browser.json)使用Chrome155.0.8059.82、1280×800及390×844/844×390、模拟DPR1/2；既有hardware scaling=1未修改，因此DPR2页面截图为2倍CSS像素，实际画布仍为390×844/844×390，未声称提高渲染分辨率。正常页面无warn/error/404，海面effect就绪，室内HDR及既有镜面/阴影目标保留。8房/全景、地图、设置、Inspector、拖动/缩放通过；Inspector的首次引导遮罩会拦截关闭按钮，脚本通过原按钮事件关闭，没有修改产品行为。

隐藏外景/全景时动画暂停；相机层/视锥排除、页面后台不推进，恢复首帧丢弃停顿delta，前台delta上限0.1秒。单测覆盖时间边界与实际观察者/页面事件清理；浏览器覆盖实际全景切换和用`document.hidden`属性模拟的后台事件，明确区别于实机切后台实验。反复销毁后网格/材质/纹理/观察者全部清空；共享房间所有权的单测保证最后一个房间释放前保留资源。

[故障记录](fault-browser.json)、[故障画面](fault-balcony.jpg)：单独8156服务器故意让岩石颜色/HDR返回404，室外PBR降级，海面仍就绪并持续动画，不反射室内环境；只有这两项预期404，没有GLSL错误或额外警告。原门/抽屉/灯/信件、连续通行、窗/栏杆安全边界由115项自动测试回归保护，本轮浏览器未复验完整真实锁定漫游路线，未将历史证据算作新证据。

## 字节与独立发布

[资源比较](resource-changes.json)、[发布清单](release-manifest.json)、[初始模块分析](bundle-analysis.json)：

| 项目 | 阶段B | 阶段C |
| --- | ---: | ---: |
| 两个目标GLB | 4,332,840 | 4,332,840 |
| 运行素材 | 15,867,631（36个） | 15,867,631（36个，15.13MiB） |
| 静态初始JS | 2,551,224 | 2,582,234 |
| 实际首屏JS含必要异步 | 2,770,076（12个） | 2,801,086（12个，2.67MiB） |
| 完整发布目录 | 42,188,912（495文件） | 42,198,889（495文件，40.24MiB） |

全部36个运行素材字节/SHA256不变。实际首屏增加31,010字节，完整目录增加9,977字节：构建+8,871、说明+1,106、清单自身不变；分包布局变化使二者增量不同。预算余量为运行素材909,585、实际首屏JS344,642、完整发布792,727字节；4.25/16/3/41MiB预算不变，全部动态Inspector/编辑器分包及来源/许可/清单均计入完整发布。

浏览器在场景/音效就绪、Inspector打开前保存实际请求URL，与最终文件字节/SHA256对应，根路径和子路径均12个必要JS/36素材；不是冷缓存传输或加载耗时实验。[独立托管校验](release-check.json)对根路径和`/home/`全部495文件逐一GET/字节/SHA256通过，无`public`补齐；白名单外森林与其他示例返回404。

## 成本、限制与复现

[结构记录](geometry.json)：室外仍16网格/7材质/1灯/1缓存阴影目标，顶点69,661→98,699，三角面80,016→137,744，孤立组件纹理对象9→10。新增256²RGBA8场为65,536像素、262,144字节，无mip；海面细分和片元程序噪声增加GPU工作量。16批次不等于包含镜面/SSAO/阴影通道的真实绘制次数；本轮未测GPU内存/峰值、FPS或加载时间。

反射只有天空和太阳。在阳台主构图/客厅望海中未发现必须增加局部反射目标的缺失，工程近岸/掠海镜头仍能察觉缺少本地崖壁倒影；本版保留这一近似。岸线按平均海面、海床为距离推导静态斜坡，泡沫不追踪每个浪峰；不宣称真实流体、海浪声音或户外漫游已实现。草簇/低灌木仍为B的静态几何，D最终多平台/实机验收及海岸稳定基线待实施；暂停的性能实验继续暂停。

复核脚本均在本目录：

1. `npm test`、`npm run typecheck`、`npm run build -- --output-path /tmp/coastal-c-development`、`npm run build:production`。
2. `python3 .../serve-dist.py`仅托管最终dist；加`--port 8156 --fault`启动故障源。阶段B同镜头参考来自实施前复制到`/tmp/coastal-c-stage-b-dist`的生产目录，用`--port 8155 --root ...`托管；重建可在独立目录恢复`98e760a`，不覆盖当前源码/冻结v1基线。
3. `PLAYWRIGHT_PACKAGE=/path/to/playwright node .../check-ocean.cjs`检查正常路径，`STUDY_URL=http://127.0.0.1:8156/ STUDY_FAULT=1`检查故障；需要本机Chrome。原始连续帧暂存`/tmp/coastal-c-animation`，用Pillow运行`process-animation.py`重新生成本目录动画/逐帧图。`check-resource-changes.cjs`、`check-release.cjs`、`check-geometry.cjs`分别复核实际首屏/摘要、独立部署和结构计数。

源码与程序素材按项目ISC记录在[程序来源](../../../../public/environment/coastal-cliff-source.json)，原CC0贴图锁定清单保持。未修改依赖、运行白名单、资源阈值或八房v1冻结清单；未纳入用户未跟踪目录。
