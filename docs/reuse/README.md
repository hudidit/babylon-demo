# 场景复用入口与稳定基线

更新时间：2026-10-17。对应[复用技术方案](../technical-plans/2026-10-17-scene-reuse-foundation.md)。本轮完成复用准备；公共库、通用房型工厂和新项目尚未实施。

本文及机器清单固定的是含森林的八房v1历史成品。当前主分支已开始[海边悬崖阶段A](../technical-plans/2026-10-17-coastal-cliff-exterior.md)，运行白名单与源码已变化；校验v1请按下文恢复稳定标签，并用`--root`指定该独立目录，不能用当前海岸工作区冒充原基线。v1清单、标签和摘要保持不变；海岸阶段验收使用各阶段独立发布记录，最终海岸稳定基线留待完成后建立。

## 1. 已固定的内容

- 场景代码：`f86c659396d3ae81a56743bdc3f74985fa590bdd`，源码树`f3c26bc328e08e1dc9834e3e3ec38afb7e681323`。
- 稳定标签：`scene-baseline/2026-10-17-eight-room-v1`，指向上述场景提交。本轮文档、清单与工具在另外的准备提交中，不改变场景版本。
- [机器资产清单](asset-inventory.json)：31个运行文件、8个原始录音、10组代码迁移入口；每个运行文件有稳定ID、字节、SHA256、许可/来源、格式和使用约定。
- [基线JSON](baselines/2026-10-17-eight-room-v1.json)：122个冻结输入、依赖/工具链、489个完整发布文件及摘要、预算和归档身份。
- [本轮验收](../technical-plans/assets/scene-reuse-2026-10-17/README.md)：工程、生产包、浏览器、恢复/摘要检查；历史专项画面证据保留引用。
- 本机完整发布归档：[2026-10-17-eight-room-v1-dist.tar.gz](../../artifacts/reuse-baselines/2026-10-17-eight-room-v1-dist.tar.gz)，22,029,367字节；SHA256为`abede1ecd6da5d617208bd44820e09d57a8b5978b5b7b9b449db0593e612a2cc`。二进制不进入Git或运行白名单，新克隆不会自动包含此文件；远端保存源码标签、清单和摘要，异地二进制备份待接入制品库。

基线不得就地覆盖。错误修正、素材替换、依赖升级或新场景应建立新版本，保留旧清单/标签。现有无关、未跟踪的用户目录不属于基线。

## 2. 运行素材清单

以下路径是八房v1的历史运行白名单；它们不是整个`public`目录。当前主分支白名单见`tools/study-release.config.cjs`。稳定ID用于历史清单，目前运行代码仍使用既有路径，尚未接入新的资产注册表。新项目迁移时同时带走来源记录与第三方声明。

| 稳定ID | 仓库路径 | 字节 | 许可状态 |
| --- | --- | ---: | --- |
| `environment.study-interior` | [environment/study-interior.hdr](../../public/environment/study-interior.hdr) | 1,649,529 | CC0-1.0 |
| `model.antique-cabinet` | [models/gothic_commode.glb](../../public/models/gothic_commode.glb) | 1,549,376 | unverified |
| `model.antique-bookshelf` | [models/wooden_bookshelf.glb](../../public/models/wooden_bookshelf.glb) | 2,783,464 | unverified |
| `model.reading-armchair` | [models/study/modern_arm_chair_01.glb](../../public/models/study/modern_arm_chair_01.glb) | 2,696,208 | CC0-1.0 |
| `model.reading-sofa` | [models/study/sofa_03.glb](../../public/models/study/sofa_03.glb) | 818,172 | CC0-1.0 |
| `image.decorative-landscape` | [textures/pictures/pic1.jpg](../../public/textures/pictures/pic1.jpg) | 29,797 | unverified |
| `texture.forest.panorama` | [textures/study/forest-window/panorama.jpg](../../public/textures/study/forest-window/panorama.jpg) | 1,858,746 | CC0-1.0 |
| `texture.forest.bark` | [textures/study/forest-window/bark.jpg](../../public/textures/study/forest-window/bark.jpg) | 52,093 | CC0-1.0 |
| `texture.wood-floor.color` | [textures/study/wood_floor/color.jpg](../../public/textures/study/wood_floor/color.jpg) | 734,493 | CC0-1.0 |
| `texture.wood-floor.normal` | [textures/study/wood_floor/normal.jpg](../../public/textures/study/wood_floor/normal.jpg) | 423,303 | CC0-1.0 |
| `texture.wood-floor.arm` | [textures/study/wood_floor/arm.jpg](../../public/textures/study/wood_floor/arm.jpg) | 447,855 | CC0-1.0 |
| `texture.wood-table-001.color` | [textures/study/wood_table_001/color.jpg](../../public/textures/study/wood_table_001/color.jpg) | 215,573 | CC0-1.0 |
| `texture.wood-table-001.normal` | [textures/study/wood_table_001/normal.jpg](../../public/textures/study/wood_table_001/normal.jpg) | 51,927 | CC0-1.0 |
| `texture.wood-table-001.arm` | [textures/study/wood_table_001/arm.jpg](../../public/textures/study/wood_table_001/arm.jpg) | 214,520 | CC0-1.0 |
| `texture.painted-wall.color` | [textures/study/painted_wall/color.png](../../public/textures/study/painted_wall/color.png) | 58,252 | ISC |
| `texture.painted-wall.normal` | [textures/study/painted_wall/normal.png](../../public/textures/study/painted_wall/normal.png) | 403,149 | ISC |
| `texture.painted-wall.arm` | [textures/study/painted_wall/arm.png](../../public/textures/study/painted_wall/arm.png) | 75,148 | ISC |
| `texture.rough-linen.normal` | [textures/study/rough_linen/normal.jpg](../../public/textures/study/rough_linen/normal.jpg) | 916,843 | CC0-1.0 |
| `texture.rough-linen.arm` | [textures/study/rough_linen/arm.jpg](../../public/textures/study/rough_linen/arm.jpg) | 1,191,393 | CC0-1.0 |
| `audio.drawer-slide-1` | [audio/study/drawer-slide-1.8353e0a53c.wav](../../public/audio/study/drawer-slide-1.8353e0a53c.wav) | 30,764 | CC0-1.0 |
| `audio.drawer-slide-2` | [audio/study/drawer-slide-2.71ff63e71c.wav](../../public/audio/study/drawer-slide-2.71ff63e71c.wav) | 28,844 | CC0-1.0 |
| `audio.drawer-stop-1` | [audio/study/drawer-stop-1.6840b8eb30.wav](../../public/audio/study/drawer-stop-1.6840b8eb30.wav) | 11,564 | CC0-1.0 |
| `audio.drawer-stop-2` | [audio/study/drawer-stop-2.b34d827382.wav](../../public/audio/study/drawer-stop-2.b34d827382.wav) | 15,404 | CC0-1.0 |
| `audio.door-move-1` | [audio/study/door-move-1.f0162ae1b8.wav](../../public/audio/study/door-move-1.f0162ae1b8.wav) | 38,444 | CC0-1.0 |
| `audio.door-move-2` | [audio/study/door-move-2.9dea4bdbfd.wav](../../public/audio/study/door-move-2.9dea4bdbfd.wav) | 55,724 | CC0-1.0 |
| `audio.door-latch-1` | [audio/study/door-latch-1.a220e2fe5d.wav](../../public/audio/study/door-latch-1.a220e2fe5d.wav) | 15,404 | CC0-1.0 |
| `audio.door-latch-2` | [audio/study/door-latch-2.fb255ede74.wav](../../public/audio/study/door-latch-2.fb255ede74.wav) | 16,364 | CC0-1.0 |
| `audio.switch-1` | [audio/study/switch-1.702a81fab4.wav](../../public/audio/study/switch-1.702a81fab4.wav) | 11,564 | CC0-1.0 |
| `audio.switch-2` | [audio/study/switch-2.927c10f6e3.wav](../../public/audio/study/switch-2.927c10f6e3.wav) | 16,364 | CC0-1.0 |
| `audio.paper-1` | [audio/study/paper-1.ce7576efe6.wav](../../public/audio/study/paper-1.ce7576efe6.wav) | 19,244 | CC0-1.0 |
| `audio.paper-2` | [audio/study/paper-2.862694da2b.wav](../../public/audio/study/paper-2.862694da2b.wav) | 27,884 | CC0-1.0 |

`unverified`三项（古董柜、书架、装饰画）的上游/作者/授权证据尚缺，跨项目分发前补齐或替换。CC0和ISC分别来自现有来源记录及项目声明，本轮只核对记录和文件，未重新进行上游许可审计。详见[素材来源](../../public/STUDY_ASSET_SOURCES.md)。

## 3. 代码资产迁移矩阵

| 资产组 | 主要入口 | 现状与迁移要求 |
| --- | --- | --- |
| 引擎注册/着色器 | [RoomRuntime](../../src/examples/RoomRuntime.ts)、[RoomShaders](../../src/examples/RoomShaders.ts) | 保持pure/精确导入和显式注册；不得靠总入口预热掩盖缺失 |
| 资源生命周期 | [HouseRooms](../../src/examples/HouseRooms.ts)、[RoomOwnership](../../src/examples/RoomOwnership.ts)、[共享材质](../../src/examples/RoomMaterialLibrary.ts) | 已有代次/最后使用者释放；需注入房间实例列表 |
| 户型/结构/行走 | [HouseLayout](../../src/examples/HouseLayout.ts)、[HouseStructure](../../src/examples/HouseStructure.ts)、[HouseArchitecture](../../src/examples/HouseArchitecture.ts)、[HouseWalking](../../src/examples/HouseWalking.ts) | 当前八房、正交矩形单层；需注入门窗/布局/出生点，共用米制转换 |
| 家具/模型适配 | [HouseRoomComponents](../../src/examples/HouseRoomComponents.ts)、[RoomFurnishings](../../src/examples/RoomFurnishings.ts)、[RoomFurnitureAssets](../../src/examples/RoomFurnitureAssets.ts) | 部分旧尺寸仍是引擎单位；保留包围盒落地/轴向适配，名称与动作ID参数化 |
| 材质/程序纹理/后期 | [RoomMaterials](../../src/examples/RoomMaterials.ts)、[RoomSurfaceDetails](../../src/examples/RoomSurfaceDetails.ts)、[RoomFinishing](../../src/examples/RoomFinishing.ts) | 颜色sRGB，法线/ARM线性；纹理共享与可变发光状态分开处理 |
| 交互/输入 | [RoomInteractions](../../src/examples/RoomInteractions.ts)、[RoomItemInspection](../../src/examples/RoomItemInspection.ts)、[RoomPointerLock](../../src/examples/RoomPointerLock.ts) | 门/抽屉扫掠和模态恢复已有；需去固定ID/DOM依赖 |
| 灯光/镜面/室外 | [RoomLighting](../../src/examples/RoomLighting.ts)、[RoomMirrors](../../src/examples/RoomMirrors.ts)、[RoomExterior](../../src/examples/RoomExterior.ts) | 固定房屋坐标/镜头范围需配置化，阴影/反射/GPU成本另计 |
| 音效 | [RoomAudio](../../src/examples/RoomAudio.ts)、[RoomAudioCatalog](../../src/examples/RoomAudioCatalog.ts) | 共享缓冲/手势解锁/空间声；实体状态独立，实机听感待验收 |
| 八房布置 | [HouseContent](../../src/examples/HouseContent.ts)、HouseSuite/Bedroom/ServiceRooms/Balcony | 作为配置和风格参考；尚不是可创建任意多间房的工厂 |
| 页面/地图/场景编排 | [Room](../../src/examples/Room.ts)、[app](../../src/app.ts)、[RoomFloorPlan](../../src/examples/RoomFloorPlan.ts)、[HouseFloorPlan](../../src/examples/HouseFloorPlan.ts) | 留在项目适配层，公共运行库不绑定现有页面选择器 |

完整文件集合与限制见机器清单的`codeComponents`。这10组是迁移边界，不是已经发布的10个包。程序生成的家具/树木/纸张/地毯/叶片等也是代码资产；动态纹理、阴影和镜面不是额外下载文件，其运行内存与GPU成本不能从31个文件总量推断。

## 4. 原件、处理工具与交付说明

- [8个原始录音](../../assets/audio-source/study/README.md)只供开发；摘要在机器清单`developmentSources`及[原件记录](../../assets/audio-source/study/source.json)，不进入运行发布。
- 古董柜/书架的压缩前原件来自`fd32f40f25f25cea679df2d30d85aaeb5a4c8a70`，逐文件原始摘要/引入提交及`detail-c85`处理参数见[模型记录](../../public/models/study-model-optimization.json)。恢复原件示例：`git show fd32f40f25f25cea679df2d30d85aaeb5a4c8a70:public/models/gothic_commode.glb > /tmp/gothic_commode-original.glb`，再按来源记录检查摘要。
- [模型工具](../../tools/optimize-study-models.cjs)、[漆面工具](../../tools/generate-painted-wall.py)、[森林工具](../../tools/prepare-forest-panorama.py)、[音频工具](../../tools/prepare-study-audio.py)与固定输入/版本一起迁移；不能再对压缩成品反复有损编码。
- 四GLB当前全部内嵌资源、无glTF扩展/外部URI，机器清单记录图片尺寸；新增GLB需重新检查扩展、解码器及全部外部依赖。
- 交付使用[发布白名单](../../tools/study-release.config.cjs)，同时保留全部动态分包、`js/*.LICENSE.txt`、Babylon许可证/NOTICE、音效credits、来源/处理说明、分析报告及清单。除解包归档外，不以复制整个`public`迁移素材。

## 5. 校验与恢复

在包含本轮准备文档与工具的仓库中执行：

```sh
node tools/verify-reuse-baseline.cjs
node tools/verify-reuse-baseline.cjs --release dist --archive artifacts/reuse-baselines/2026-10-17-eight-room-v1-dist.tar.gz
```

第一条检查源码标签、122个冻结输入及31个运行素材；未提供发布目录/归档时会明确报告未检查。第二条另外核验489个发布文件的精确集合与摘要，以及归档文件的字节/摘要。工具只读，不刷新清单或自动修复差异。

新项目需要原场景源码时，在独立目录恢复，不重置正在使用的工作区：

```sh
git clone --branch scene-baseline/2026-10-17-eight-room-v1 --single-branch git@github.com:hudidit/babylon-demo.git ../babylon-eight-room-baseline
cd ../babylon-eight-room-baseline
npm ci
npm test
npm run typecheck
npm run build -- --output-path /tmp/eight-room-baseline-development
npm run build:production
```

源码标签为八房原提交，不包含后加的复用文档/工具。回到包含准备工具的原仓库，使用它校验新恢复的目录：

```sh
node tools/verify-reuse-baseline.cjs --root ../babylon-eight-room-baseline --release ../babylon-eight-room-baseline/dist
```

`--root`选择待检查的源码目录，清单仍从校验工具所在的准备仓库读取。应使用基线记录的Node/npm/Babylon/TypeScript/Webpack及锁文件；源码恢复不保证不同平台/工具链下构建逐字节相同，摘要不一致时保留差异另查，不覆盖v1。

如需完全相同的成品，校验本机归档SHA256后解包到新的空目录：

```sh
mkdir -p /tmp/eight-room-frozen-release
tar -xzf artifacts/reuse-baselines/2026-10-17-eight-room-v1-dist.tar.gz -C /tmp/eight-room-frozen-release
node tools/verify-reuse-baseline.cjs --release /tmp/eight-room-frozen-release/dist
python3 -m http.server 8081 --bind 127.0.0.1 --directory /tmp/eight-room-frozen-release/dist
```

完整目录为42,756,315字节（40.78MiB）；运行素材16,457,409字节（15.70MiB），两个目标GLB为4,332,840字节（4.13MiB），静态首屏JS为2,532,592字节，本轮浏览器实际首屏含必需异步JS为2,751,444字节（2.62MiB）。这些是文件/请求字节，不代表FPS或加载耗时收益。

## 6. 下一阶段入口

只在独立新项目提炼`scene-kit / asset-pack / starter`，固定版本后重建八房并与本基线比较；然后验证两个同类型房间的ID、灯/门/抽屉状态和资源释放隔离，再生成更大户型。公共库不能直接读取当前固定房间常量、页面DOM或共享可变灯具材质。具体步骤与验收见技术方案阶段1～4。
