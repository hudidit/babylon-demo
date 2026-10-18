# 海岸阶段D：工程交付与平台验收记录

日期：2026-10-18。运行代码基线`d1ae3a1`，对应[主方案](../../2026-10-17-coastal-cliff-exterior.md)。本轮工程、可用环境及稳定基线已交付；Firefox/Safari/物理移动端仍受环境限制，D完整平台范围未全部通过。场景代码、素材、依赖、灯光/后期和预算没有修改；新工具与元数据在准备提交中单独交付。

## 工程与现有功能

- [123项测试](tests.log)、[类型检查](typecheck.log)、[临时开发构建](development-build.log)、[生产构建/自动发布校验](production-build.log)通过。新增2项只读基线选择/路径失败测试，原pure独立进程、资源完整性/超预算/缺失注册、碰撞/海岸结构/生命周期测试继续执行。保留3项Webpack体积/分包建议，未调整阈值。
- [完整Chrome回归](regression/browser.json)：8抽屉、8灯、7平开门及阳台推拉门、双面操作/扫掠保护、12次双向门洞碰撞、55段连续全屋路线和分房通路、真实pointer lock与模态恢复、地图/信件/设置/Inspector、拖动缩放、异步家具失败隔离、重复pagehide销毁通过，正常错误/警告/404为空。旧次卧路线经过后来移动到南窗的阅读凳，本次按实际通道由y=10.25改走y=9.9；没有取消碰撞断言或修改家具。
- [跳跃记录](jump/jump.json)：眼高3→6.443→3，基础速度0.825，床/沙发/茶几/椅/阳台/地面落点正确，全景空格不移动。原脚本在指针锁定中尝试点击其他UI按钮会被锁定光标影响，改为先退出锁定再真实点击，产品输入逻辑未修改。
- 主卫[镜面/地图像素](mirrors/master/mirror-map.json)与公卫[镜面像素](mirrors/public/public-mirror.json)通过：移除坐便器改变5,123/2,088像素，恢复后摘要一致，灯/门/相机变化有效，背向/视锥外缓存；两个512²反射目标无额外mirror prepass。精确像素比较固定海面着色时间，交互时间仍推进，避免把海浪动画误算成镜面变化；连续海面另行保存。
- [外景缺图记录](fault-browser.json)：专用8161源故意让岩石颜色/HDR返回404，房屋与基础功能可用，海面effect就绪且时间推进，室内HDR保持；只有2项预期404，没有GLSL错误。正常托管不包含这些故意失败。

## 平台与画面

[矩阵](engines/matrix.json)保存实际版本、视口/画布、DPR、资源URL、就绪状态、隐藏/恢复、销毁及日志。不是所有尝试均通过：

| 环境 | 实际结果 | 范围与边界 |
| --- | --- | --- |
| Chrome155.0.8059.82 | 通过 | macOS WebGL2，3视口×DPR1/2共6组合；完整交互在Chrome单独执行 |
| Playwright WebKit26.5 | 通过 | 同6组合及八房/全景、连续海面/资源/隐藏恢复/重复销毁；是桌面WebKit测试构建，不能写成Safari或iPhone实机 |
| Playwright Firefox Nightly | 启动失败，未验 | 已安装运行时在无头/可见窗口及临时进程诊断均无法建立会话，日志有macOS sandbox extension与帧缓冲问题；未将不可用引擎算作通过 |
| Safari WebDriver | 自动化未启用，未验 | [实际会话响应](safari-availability.json)要求用户启用“允许远程自动化”；没有改动该设置 |
| 物理移动设备 | 未验 | 没有已提供的可访问实机证据；本机无simctl；手机尺寸/DPR模拟不替代真实设备 |

正常已运行引擎均无warn/error/404。Firefox保留[无头尝试](engines/matrix.json)、[可见窗口日志](firefox-visible-launch.log)、[临时进程诊断](firefox-process-launch.log)；诊断开关仅作用于临时进程且未成功，不更改用户浏览器配置。`check-engines.cjs`在任一引擎失败时返回非零，完整三引擎矩阵不能写为通过。

视口为1280×800、390×844、844×390，DPR1/2；保持现有hardware scaling=1，DPR2截图尺寸是CSS的两倍，实际画布尺寸仍等于CSS视口，没有提高渲染分辨率或降低既有画质设置。保存Chrome/WebKit八房和[Chrome阳台](engines/chromium-balcony-desktop-dpr1.jpg)/[WebKit阳台](engines/webkit-balcony-desktop-dpr1.jpg)、[WebKit次卧海窗](engines/webkit-bedroom.jpg)、横竖屏及[Chrome连续海面](engines/chromium-ocean.webp)/[WebKit连续海面](engines/webkit-ocean.webp)。每组12帧、固定0.2秒动画步长，见[逐帧检查](engines/animation-check.json)；不属于FPS/加载速度或物理设备闪烁测试。

## 生产目录与字节

[发布校验](release-check.json)对根路径和`/home/`全部495文件GET/字节/SHA256通过，含所有动态分包、来源/许可和清单；白名单外森林/其他示例返回404，没有从`public`补齐。[发布清单](release-manifest.json)、[初始模块图](bundle-analysis.json)、[实际请求比较](resource-changes.json)独立保存。

| 项目 | 本轮最终结果 | 预算 |
| --- | ---: | ---: |
| 两目标GLB | 4,332,840字节 | 4.25MiB |
| 36运行素材 | 15,867,631字节（15.13MiB） | 16MiB |
| 静态初始JS | 2,587,055字节 | 3MiB |
| 实际首屏JS含必需异步 | 2,805,907字节（12个，2.68MiB） | 3MiB |
| 完整发布 | 42,203,792字节（495文件，40.25MiB） | 41MiB |

Chrome/WebKit根路径/子路径实际初始URL均对应12JS/36素材。正常缓存，未计冷传输或加载耗时。36素材与阶段C逐字节/摘要保持；相对C的JS/完整目录+4,903字节来自之前已提交的次卧窗、全景、跳跃和窗框修复，本轮没有运行代码增量。运行素材/首屏/完整目录分别余909,585/339,821/787,824字节。

## 结构与运行成本

[固定视角绘制/资源计数](draw-resource-snapshots.json)记录实际WebGL draw call，含当时镜面/阴影/后期通道：

| 视角 | 绘制调用 | 活动网格 |
| --- | ---: | ---: |
| 全景 | 711 | 585 |
| 客厅 | 384 | 376 |
| 次卧 | 152 | 141 |
| 阳台 | 40 | 28 |
| 第一人称入口 | 237 | 226 |

这些是1280×800稳定姿态的单次计数，不能推广成所有帧或性能收益。当前612网格、504,631顶点、80材质、147纹理对象、16灯、3相机，室外16网格/98,699顶点；对象清单包含原有多张阴影、双卫镜面与SSAO目标。新增于C的256²RGBA8岸线场仍65,536像素/262,144字节，无mip；海面无反射/折射目标。未测GPU/显存峰值、FPS或加载耗时，原暂停实验保持暂停。

## 稳定基线与恢复

[海岸v1入口](../../../reuse/coastal-cliff-v1.md)、[36素材清单](../../../reuse/coastal-asset-inventory.json)、[基线JSON](../../../reuse/baselines/2026-10-18-coastal-cliff-v1.json)独立于森林v1。标签`scene-baseline/2026-10-18-coastal-cliff-v1`固定`d1ae3a1`运行提交，137输入/495完整发布摘要；验证工具新增`--baseline`，默认仍是旧森林清单。

[本机完整归档](../../../../artifacts/reuse-baselines/2026-10-18-coastal-cliff-v1-dist.tar.gz)为21,445,986字节，SHA256 `b1c9995733a857c78321d00d40c8b30704aa15ba47db69a07c67de5a96e660c7`，保持全部分包和说明。验证记录包括[当前输入/发布/归档](baseline-verification.json)、[独立克隆检出](source-restore-verification.json)、[归档解包](archive-restore-verification.json)及[旧森林v1仍通过](forest-v1-verification.json)。独立恢复没有重新安装依赖/重建生产包；源码可恢复不保证任意工具链的产物摘要相同。归档仅本机保存，远端保存源码标签与准备清单，不是远端二进制备份。

没有覆盖旧v1的资产清单、源码标签或输入摘要。古董柜、书架、装饰画的许可仍`unverified`；海岸照片保留固定CC0来源和处理摘要，程序几何/天空/海面保留项目ISC，不将其变成已发布的公共SDK。

## 复核入口与遗留项

本目录`check-regression.cjs`、`check-jump.cjs`、两个mirror脚本、`check-draws.cjs`、`check-faults.cjs`使用`PLAYWRIGHT_PACKAGE=/path/to/playwright`，默认本机Chrome和`http://127.0.0.1:8160/`；`serve-dist.py --port 8161 --fault`启动负向源。`check-engines.cjs`使用已安装的Playwright浏览器，可通过`PLAYWRIGHT_BROWSERS_PATH`选择；完整矩阵预期所有引擎通过，当前Firefox失败明确保留。`process-animation.py`将12帧原始PNG转换为可审阅动画/四帧图后移除临时PNG。

`archive-release.py`和`capture-baseline.cjs`只允许创建不存在的新版本，不会刷新现有冻结快照；重复验收应运行只读校验器。归档打包参数、Node/npm/Babylon/TS/Webpack版本和摘要在新基线内记录。

需要可用Firefox运行环境、启用Safari远程自动化及提供物理移动设备后才能补齐剩余平台项目。它们没有被跳过后计为成功；实机听感、户外行走、海浪声音、真实流体、昼夜天气及暂停性能实验未包含在本轮交付中。
