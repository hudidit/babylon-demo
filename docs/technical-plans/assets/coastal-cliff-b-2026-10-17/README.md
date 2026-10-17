# 海岸阶段B：静态真实感验收

日期：2026-10-17。代码基线`0a9ef96`（阶段A），本记录随“完成海边悬崖阶段B静态真实感”任务提交；阶段C/D仍待实施。[主方案](../../2026-10-17-coastal-cliff-exterior.md)。

## 实现与取舍

- 采用 Poly Haven CC0 的 [Seaside Rock](https://polyhaven.com/a/seaside_rock)（Dimitrios Savva，2m）和 [Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock)（Rob Tuytel，15m）。[锁定输入](../../../../tools/coastal-material-inputs.json)、[重建脚本](../../../../tools/prepare-coastal-materials.py)和[交付清单](../../../../public/textures/coastal/source.json)包含PNG原件URL/SHA256、作者/许可、交付SHA256、尺寸及处理参数。原件放在发布目录之外，可从固定URL获取并校验；不再次压缩已交付JPEG；[重复重建](reproducibility.json)的七个交付文件与来源清单字节一致。工具为Python3.12.14/Pillow12.3.0/NumPy2.3.5/libjpeg6.2。
- 2K岩石颜色、1K岩石法线/ARM；1K地表颜色、512法线、256ARM。六张图与4,444字节解析天空HDR共1,321,061字节（1.26MiB）。[高质量候选](material-candidate-high.json)为2,052,573字节，超过1.55MiB设计额度而未交付；最终候选经阳台、室内望海、屋外侧视检查。
- 崖壁UV沿全局岸线弧长/高度按2m展开，各分区纹理相位和沿岸法线一致，保留垂直岩层折面；补入固定岩层碎裂、低频色差、暖灰风化及近海湿润色/粗糙度。地表按距崖缘混入裸岩，草苔/土石扫描采用三图一致的随机平移混合：HEX_TILING旋转0、亮度权重0，避免法线旋转或三图漂移。地表每图采样1→3次，合计3→9，属于画质成本；WebGL1回退普通平铺，本轮WebGL浏览器画面通过，不声明其他平台已验证。
- 62块嵌入地面的低模岩块与合批不透明草簇/低灌木使用真实几何。第一轮发现岩块法线向内造成发黑，已修正并增加朝向测试；屋外侧视发现草地重复与崖面棋盘明暗后，加入上述随机平移和沿岸法线平滑。`candidate-west-sun.jpg`是早期日光方向候选，不是最终验收图。
- 室外材质单独使用128面解析天空HDR的运行时预过滤，天空、环境和方向光共享太阳方向/颜色。场景室内HDR、原室内灯参数、玻璃及双卫镜面保留。新增一个限定室外PBR的方向光、一张1024²缓存阴影；固定250世界单位正交范围，57个显式外壳/栏杆/近景草石基座批次（35,810顶点），排除家具、移动门、远海和远崖。静止时缓存，切视角/剖面变化时刷新。
- 最后一个房间释放才销毁共享室外网格、材质、纹理、灯、阴影与销毁观察者。岩石颜色或HDR缺失时仅室外材质降级，不能切回可见的室内HDR倒影。

## 工程与交付

112项测试、类型检查、临时目录开发构建、生产构建与发布校验通过；见[测试](tests.log)、[类型](typecheck.log)、[开发构建](development-build.log)、[生产构建](production-build.log)。独立pure注册进程不使用core总入口预热；NullEngine无法上传HDR，单测在延迟纹理模式检查结构/接线和清理，实际纹理及GLSL在生产WebGL浏览器检查。没有修改包依赖、全局注册、预算或旧v1冻结清单。

[资源变化](resource-changes.json)、[发布清单](release-manifest.json)、[初始模块报告](bundle-analysis.json)：

| 项目 | 阶段A | 阶段B |
| --- | ---: | ---: |
| 两个目标GLB | 4,332,840 | 4,332,840 |
| 运行素材 | 14,546,570（29个） | 15,867,631（36个，15.13MiB） |
| 静态初始JS | 2,534,008 | 2,551,224 |
| 实际首屏JS（含必需异步） | 2,752,860（12个） | 2,770,076（12个，2.64MiB） |
| 完整发布目录 | 40,846,327（487文件） | 42,188,912（495文件，40.23MiB） |

原29个运行素材的字节/SHA256全部保持。完整发布净增1,342,585字节：素材+1,321,061、构建产物+11,217、说明+8,761、清单自身+1,546。预算余量为运行素材909,585、实际首屏JS375,719、完整发布802,704字节；GLB/16MiB/3MiB/41MiB阈值不变。

浏览器在房间和音效就绪、Inspector打开前保存[根路径资源URL](initial-browser-assets.json)，与最终生产文件字节/SHA256匹配；36素材均已请求，包含全部12个必要JS，无视角触发的遗漏统计。[子路径请求](subpath-browser-assets.json)得到相同12JS/36素材。正常浏览器缓存，不是冷缓存传输/耗时实验。

只托管最终`dist`，根路径和`/home/`的全部495文件GET/字节/SHA256通过，含完整懒分包、来源、许可、清单自身；不从`public`补齐。[结果](release-check.json)、[复核脚本](check-release.cjs)、[托管脚本](serve-dist.py)。正常托管缺失森林/无关桶模型返回404为预期；见[HTTP记录摘要](http-summary.json)。

## 画面与行为

[浏览器记录](browser.json)与[子路径记录](subpath-browser.json)保存实际视口、像素尺寸、就绪状态和空的warn/error日志。最终17张主流程截图，另有子路径/失败截图；重点包括：

- [阳台1280×800](balcony-desktop.jpg)、[390×844](balcony-portrait.jpg)、[844×390](balcony-landscape.jpg)：海面/天空完整，草坡与侧向岩岬有体积、崖层可读，近景没有垂直UV塌缩或规则贴图墙。
- [客厅望海](living-toward-sea.jpg)、[横移1m](living-shift-right-1m.jpg)、[推拉门打开](balcony-door-interaction.jpg)：Inspector仅用于相机数值取景；真实横移与门动作提供近远遮挡/视差，外景不抢拾取。
- [屋外侧视](exterior-side.jpg)：整屋、基座和崖顶连续承托，分层/风化及近海湿润带、崖体入水可见。工程镜头在50m剖切范围之外，非新增产品预设。
- [书房](study-desktop.jpg)、[客厅](living-desktop.jpg)、[主卧](master-desktop.jpg)、[主卫](ensuite-desktop.jpg)、[次卧](bedroom-desktop.jpg)、[厨房](kitchen-desktop.jpg)、[公卫](bathroom-desktop.jpg)、[全屋](overview-desktop.jpg)：室内布置、既有光照与双卫镜面保留；窗外各方向为同一世界中的草坡/海岸。
- [地图](floor-plan.jpg)、设置/音效就绪、Inspector开关、[第一人称入口](first-person-entry.jpg)及ESC恢复通过；原门/抽屉/灯、碰撞/安全边界、连续通行路线由自动测试覆盖。
- 单独8152负向服务对岩石颜色与室外HDR故意返回404，仍可进入阳台，材质降级、正常退出，无GLSL错误；见[负向记录](fault-browser.json)、[画面](fault-rock-and-hdr.jpg)、[模拟器](serve-fault.py)。这些故意404不计入正常托管成功请求。旧测试来源一度有既有室内木纹法线加载失败；全新来源对照见[诊断记录](fault-investigation.json)，未扩大为室内材质改造。最终不含诊断代码的固定产物在新来源连续三次就绪，详见负向记录。

## 几何、纹理与限制

[结构记录](geometry.json)可用[脚本](check-geometry.cjs)复核，均为NullEngine对象计数，不是GPU实测：室外14→16网格、26,739→69,661顶点、36,572→80,016三角面、4→7材质；六张地图加一个HDR共享。孤立组件场景9个纹理对象包含共享PBR BRDF和一张阴影目标，完整房屋已有BRDF，不重复新增；新增一个灯、一张持久阴影目标，无新增相机。16个网格批次不是包含镜面/SSAO/阴影通道的实际GPU绘制次数。

六张图共7,667,712像素，按RGBA8和完整mip估算39MiB；128×128×6环境另有预过滤mip/临时目标，1024²阴影也有GPU开销。实际GPU分配/峰值未采样；不能用1.26MiB下载大小代替显存成本，不能据顶点/字节推断FPS或加载速度。

阶段C的波浪、海面反射/高光、泡沫与海雾仍未实施；海面保留静态占位。草簇/低灌木为静态简化几何，天空环境不包含本地房屋/崖壁倒影。既有渲染器强制hardware scaling=1，本轮截图像素密度1；DPR2设备和其他平台留在D。内置浏览器未授予pointer lock，本轮只验证入口/点击/ESC拒绝恢复，没有复验真实锁定行走，不将历史Chrome路线冒充本轮证据。FPS、加载耗时实验继续暂停。地图说明中仍有原有“待布置”旧文案，本轮未改，后续独立修正。
