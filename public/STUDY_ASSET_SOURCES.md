# 书房发布资源来源

本目录只包含当前书房运行素材、生产页面与全部动态调试分包。文件摘要和字节数见 [发布清单](release-manifest.json)。各类素材的许可状态独立记录。

## 昼夜流转：第二阶段视觉联动（2026-10-19）

八节点时间参数来自项目原创美术设计，不是特定地点/日期的天文观测。方向光复用为太阳/月光，天空球与海面共用解析天空和当前天体参数；窗光按开口朝向接受直射，室内外环境强度分别变化，人工灯开关与暖色保留。曝光/ACES保持，未新增下载、实时环境探针或阴影目标。菜单、平滑过渡与自动时钟属于后续阶段。

`environment/coastal-daylight.hdr`保留原运行路径，内容替换为原创、无太阳亮斑的中性低频环境。由`tools/generate-coastal-environment.py`使用Python标准库从`CoastalSky.COASTAL_ENVIRONMENT`确定性生成；可用`--check`校验，六张扫描图不重新压缩。原/新字节与SHA256、替代原因和生成参数见[海岸来源清单](textures/coastal/source.json)。128面预过滤和材质级时段色调近似天空间接照明，不能复现完整定向彩色天空反射或现实月光照度。资源白名单路径与36个下载文件数量不变。

## Poly Haven 素材

地板 `wood_floor`、木材 `wood_table_001`、亚麻 `rough_linen`、沙发 `sofa_03`、扶手椅 `modern_arm_chair_01` 和环境 `brown_photostudio_01` 的来源、作者、下载 URL、原件摘要及处理方式见 [来源清单](textures/study/manifest.json)。这些素材按来源记录使用 [CC0-1.0](https://polyhaven.com/license)。清单中 `public/` 前缀对应开发仓库，发布路径去掉该前缀；模型的 `sourceFiles` 为上游文件记录，不是额外运行依赖。该历史清单中的 `brick_wall_001` 已被漆面替换，不再作为运行素材发布。

历史森林远景与树皮来自 Andreas Mischok 的 [Forest Slope](https://polyhaven.com/a/forest_slope)，按来源记录为 CC0-1.0。当前场景已切换为三维海岸，阶段A/B已完成，森林图片及其处理记录退出当前发布白名单；历史原件、来源记录和八房v1稳定基线仍保留在开发仓库，不能把历史森林清单当作当前海岸素材。

## 仓库已有素材

- `models/gothic_commode.glb`、`models/wooden_bookshelf.glb`：仓库引入提交分别为 `9a2d8c1`、`0e83f4c`，未记录上游、作者及许可，状态为 `unverified`。本轮只压缩内嵌 JPEG，保留几何、UV、节点与材质；详见 [独立处理记录](models/study-model-optimization.json)。两件模型不继承 Poly Haven 清单的 CC0 声明。
- `textures/pictures/pic1.jpg`：仓库已有装饰画，未提供可靠的上游、作者及许可记录，状态为 `unverified`。

## 程序与第三方库

交互音效来自 laleksic 的 [Various Sound Effects](https://opengameart.org/content/various-sound-effects)，按作者声明使用 CC0-1.0。选用八个无损实物录音原件，裁成十二个短单声道 PCM WAV；来源、原件/交付摘要、剪辑区间与处理参数见[音频来源记录](audio/study/source.json)，面向用户的[音效来源页](audio/study/credits.html)随发布交付。录音不是 AI 或程序合成；原件保留在开发仓库 `assets/audio-source/study/`，不进入运行白名单。

`textures/study/painted_wall` 为本项目原创的暖米白乳胶漆微表面纹理，不是外部扫描素材，不继承 Poly Haven 的 CC0 声明；按项目源代码条款使用。生成脚本、固定种子、颜色/法线/ARM语义及最终文件摘要见[漆面来源记录](textures/study/painted_wall/source.json)。三张512² PNG采用无缝周期细噪声，保留轻微滚涂颗粒，不包含砖缝或裂纹。

书房、客厅和全屋结构的程序几何、程序纹理与交互由项目代码构建。主卧与次卧床/柜、次卧阅读凳/台灯、双卫洁具/淋浴/瓷砖勾缝、厨房橱柜/水槽/灶台/冰箱和阳台推拉门/长凳/边桌为本项目原创程序组件，按项目源代码条款使用，复用既有木纹、织物、透明门窗和室内HDR；未增加下载模型或图片。浴室镜面使用512²实时平面反射目标，绘制所在卫浴的实际几何，不使用HDR中的其他房间作倒影。Babylon.js 的许可证和声明随发布目录保留：[Apache-2.0](licenses/babylonjs-Apache-2.0.md)、[NOTICE](licenses/babylonjs-NOTICE.md)。Webpack 从分包提取的第三方声明保留在对应的 `js/*.LICENSE.txt` 中，全部纳入发布清单。

海岸阶段A的连续崖顶地形、分层崖壁/岩岬、房屋基座、静态海平面和顶点色天空为本项目原创程序几何，按项目源代码条款（ISC）使用；阶段A当时未下载图片、模型或室外HDR。米制尺寸、生成方式、来源代码和当前限制见[海岸程序来源记录](environment/coastal-cliff-source.json)。阶段B已接入下述PBR与室外日光，动态海浪留待阶段C。

## 海边悬崖：阶段B静态材质（2026-10-17）

当前外景为连续三维崖顶/岩岬，替代森林摄影远景；阶段A灰盒为历史记录。岩石使用 [Seaside Rock](https://polyhaven.com/a/seaside_rock)，作者 Dimitrios Savva，扫描覆盖2×2m；地表使用 [Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock)，作者 Rob Tuytel，覆盖15×15m，均按 [Poly Haven CC0](https://polyhaven.com/license) 使用。来源许可仅适用于这两套贴图，不改变既有 unverified 柜体、书架或装饰画的状态。

[海岸材质来源与加工清单](textures/coastal/source.json)保存固定无损PNG下载URL、原件SHA256、交付SHA256/字节、Pillow/NumPy版本、Lanczos/法线归一化/JPEG参数；脚本为仓库`tools/prepare-coastal-materials.py`，输入锁为`tools/coastal-material-inputs.json`，从校验原件重建，不对交付图重复压缩。颜色为sRGB；OpenGL切线法线与ARM为线性，ARM的R=AO/G=粗糙度/B=金属度，材质强制非金属。

海岸几何、静态实体草叶/低灌木/岩块、天空与小HDR为项目程序生成（ISC），无AI图片；[程序来源](environment/coastal-cliff-source.json)记录当前版本和限制。室外材质级环境覆盖保留室内HDR，局部方向光/1024缓存阴影不受室内灯开关影响。阶段C海面使用固定世界坐标解析波/过滤细浪法线、同源天空反射/太阳高光及海雾；512²程序距离/深度场来自实际崖壁海平面截面，控制水色及动态破碎泡沫，无新增下载素材。静态岸线不跟随每个浪峰，反射不含本地房屋/崖壁；无海面反射/折射RTT。


## 悬崖灯塔与沿海步道：阶段C视觉完成（2026-10-18）

灯塔收分塔身/实际门窗凹口、闭门/石基、玻璃灯室/内部灯具、检修栏杆、路牌、木护栏/长椅及低坡金属屋顶/屋檐/外窗台为项目原创程序几何（ISC）。外墙风化、木纹、铺石接缝和屋面立缝由过滤的世界坐标材质表达；路面/石基复用现有海岸岩石三张图及原室外HDR，不新增下载模型、贴图或解码依赖。路线旁确定性草石分三块，避让主路和两处平台；室内材质、地面支撑与通行边界保留。细节距离滞回与单个1024²缓存局部阴影图覆盖近宅/途中/塔区；首屏基础道路和塔体已就绪。门窗关闭，未实现塔内、夜景光束或载具。来源与局限见[程序来源记录](environment/coastal-cliff-source.json)。

## 灯塔运行：基础运行与首次巡检第二阶段（2026-10-20）

沿用已交付的五层/垂直梯、工作照明、昼夜时钟和第一阶段运行状态，将原静态中心透镜/金属环分离为独立旋转头，保护框、底座和外层玻璃固定。单侧发光面、不对称机件、顶层固定试灯控制和首层面板拆分均为项目原创程序几何；方向白闪GLSL、中文设备界面和记录图集字形修改按项目ISC条款使用，来源及可复现参数见[程序来源记录](environment/coastal-cliff-source.json)的`lighthouseOperation`。复用原材质、音效、1024×512图集与已启用的后期，不下载新图片、模型或依赖。

白闪依据旋转相位与各观察方向求值，单束每10活跃秒一圈；18点至次日6点自动导航，白天可在灯座旁试灯30活跃秒。远景不足像素时，仅对原发光面补偿最小3像素宽的亮点，保持真实深度与裁切；这是可读性近似，不扩大实际碰撞或光照覆盖。没有新增灯、相机、RTT或阴影图，也没有海面/住宅扫光、体积光柱或经过标定的真实航海射程。原工作灯独立；当前稳定供电，巡检清洁、完整主备和电池监测仍待后续，不以固定图面声称已检查或设备全面正常。
