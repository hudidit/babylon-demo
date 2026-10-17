# 次卧面海窗改造验收

2026-10-17，代码基线`4091e84`（海边悬崖阶段C），对应[次卧面海窗改造方案](../../2026-10-17-bedroom-sea-facing-window.md)。

## 实际交付

- [HouseStructure](../../../../src/examples/HouseStructure.ts)将次卧唯一窗户从西墙`x=0`移到南墙`y=10.8m`，窗洞`x=2.9～4.9m`、宽2.0m、窗台0.9m、高1.5m；窗户朝南，与阳台面向同一片海。原西墙恢复完整实体墙面。
- 新增`houseWindowSide()`从房间边界判定`north/south/east/west`，[HouseArchitecture](../../../../src/examples/HouseArchitecture.ts)用同一结果选择窗框/窗台/窗帘的朝内旋转，避免南窗把窗帘和窗台装到室外。西/北/东三侧窗的最终朝向保持不变。
- [HouseBedroom](../../../../src/examples/HouseBedroom.ts)阅读凳移到窗下并旋转90°：局部根部`(3.9, 3.3)`，1.3×0.45m软垫、木架、托盘和书籍随手转向，仍然落地且有实体碰撞；凳前沿与床尾之间保留约0.76m通道。
- [RoomLighting](../../../../src/examples/RoomLighting.ts)次卧日光移到南窗内侧，方向朝北向下，保留原光强、范围、1024²阴影和房间归属。
- [Room](../../../../src/examples/Room.ts)次卧预设改为从北侧看向南窗，FOV 0.8、环绕下限4；手机竖屏拉远系数封顶1.9，避免近景预设变成全屋鸟瞰。第一人称和其他房间预设不变；全屋全景的外壳显示见下一节。
- 全屋全景改为**无顶、半透明外壳**：墙面材质在 overview 下alpha=0.32、ALPHABLEND，仍显示六处窗户和门框，天花隐藏；透过墙体能看到床、柜和房间布置。进入各房间/第一人称后墙面恢复不透明，房间视图仍按镜头做选择性剖面。
- 没有新增模型、图片、程序贴图、依赖、灯、相机或渲染目标；海面、天空、崖壁、室内HDR/ACES、门/灯/镜面/地图及原交互沿用。

## 画面与行为

- [改造前次卧预设](before-bedroom-preset.jpg)（西窗、无海）与[改造后次卧预设](bedroom-preset-1280.jpg)；[改造前南墙](before-south-wall.jpg)与[窗内看海](window-sea-1280.jpg)。
- [阅读凳与南窗近景](window-seat-1280.jpg)、[原西墙已为实体墙](west-wall-1280.jpg)、[南立面外观](south-facade-1280.jpg)。南立面为证据专用相机姿态，脚本清除第一人称步行约束后取景，没有增加可走出房屋的路线。
- 横竖屏：[次卧预设竖屏](bedroom-preset-390x844.jpg)/[横屏](bedroom-preset-844x390.jpg)，[窗内看海竖屏](window-sea-390x844.jpg)/[横屏](window-sea-844x390.jpg)。窗框、窗台、窗帘、玻璃和家具无反向、悬浮或明显穿插；窗内可见海平线、近岸草地/崖缘和阳台栏杆。
- 全景：[半透明桌面](overview-transparent-1280.jpg)/[半透明竖屏](overview-transparent-390x844.jpg)。页面内实测墙面alpha=0.32、transparencyMode=2，6个窗玻璃全部可见、可见天花0；切回次卧后alpha恢复1/opaque。[overview.json](overview.json)记录该结果，房间视图的选择性剖面仍由117项测试覆盖。
- [浏览器记录](browser.json)：Chrome 155.0.8059.82，1280×800、390×844、844×390，DPR1；正常流程无运行/着色器错误、无警告、无404。次卧预设地图高亮正确，相机目标朝南；窗洞、玻璃透明度、座椅与日光方向均由页面内实际场景断言。
- 117项测试、类型检查、开发构建、生产构建与自动发布校验通过；见[测试](tests.log)、[类型检查](typecheck.log)、[开发构建](development-build.log)、[生产构建](production-build.log)。测试新增南向窗/西墙实体/座椅居中/日光朝向/全景窗户断言，并把次卧通路改为实际0.76m床尾通道；原门扫掠、家具阻挡和独立控灯继续通过。
- [子路径记录](subpath.json)在本机`/home/`临时托管下通过：场景/音效就绪，49个请求均在子路径内且成功，12个JS。只托管最终dist，不以开发服务器补齐。见[子路径脚本](check-subpath.cjs)。

## 字节、资源与预算

[资源比较](resource-changes.json)、[发布清单](release-manifest.json)、[初始模块分析](bundle-analysis.json)：

| 指标 | 阶段C `4091e84` | 本次 | 预算 |
| --- | ---: | ---: | ---: |
| 36个运行素材 | 15,867,631字节（15.13 MiB） | 路径/字节/SHA256完全相同 | ≤16 MiB |
| 两目标GLB | 4,332,840字节 | 完全相同（4.13 MiB） | ≤4.25 MiB |
| 静态初始JS | 2,582,234字节 | 2,582,941字节 | ≤3 MiB |
| 实际首屏JS，含必需异步/音频 | 2,801,086字节（12个JS） | 2,801,793字节（2.67 MiB） | ≤3 MiB |
| 完整发布，含清单自身 | 42,198,889字节（495文件） | 42,199,596字节（40.24 MiB） | ≤41 MiB |

完整发布净增707字节，全部来自`js/main.js`（窗位改造553、全景外壳26、半透明材质128）；495个文件数、入口/动态分包布局、10个说明文件和36个运行素材均不变。`bundle-analysis.json`记录的模块信息变化但文件字节数相同。浏览器实际首屏12个JS与静态初始JS的差值来自既有异步/音频模块，不是冷缓存传输或加载耗时测量。完整发布校验见[release-check.json](release-check.json)。

场景对象计数保持612网格/509,239顶点/80材质/147纹理/3相机；灯仍16个，未新增灯或渲染目标。这次改动复用现有窗组件、座椅和材质，没有新增纹理下载或重复请求。

## 边界与复现

- 窗玻璃仍是防穿越边界，未开放室外行走；次卧门、床、衣柜、床头柜和阅读凳保持实体。真实指针锁定漫游未在本轮内重复做全路线浏览器验收，原自动碰撞/路线测试保留。
- 截图和固定delta只用于画面/交互证据，不是FPS、加载耗时、GPU内存或帧率收益；DPR1模拟不代表实机移动端。阶段D海岸最终多平台验收仍未包含在本轮。
- 复现：

```sh
npm test
npm run typecheck
npm run build -- --output-path /tmp/bedroom-sea-development
npm run build:production
python3 -m http.server 8113 --bind 127.0.0.1 --directory dist
```

另一个终端：

```sh
PLAYWRIGHT_PACKAGE=/path/to/playwright STUDY_URL=http://127.0.0.1:8113/ \
STUDY_CHECK_OUTPUT=/tmp/bedroom-sea-check node check-bedroom-sea.cjs
```

将`dist`挂在临时目录的`home/`下并在8115托管，运行：

```sh
PLAYWRIGHT_PACKAGE=/path/to/playwright STUDY_SUBPATH_URL=http://127.0.0.1:8115/home/ \
STUDY_CHECK_OUTPUT=/tmp/bedroom-sea-check node check-subpath.cjs
```

代码、测试、方案/索引/变更日志及本记录随“将次卧窗户改为面朝大海”提交推送，准确标识见Git历史。
