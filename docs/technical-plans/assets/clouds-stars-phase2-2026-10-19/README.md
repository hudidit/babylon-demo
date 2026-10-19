# 白云与星空第二阶段：反射联动与视觉校准

日期：2026-10-19；输入提交：`fefe1b3`。状态：第一、二阶段已完成，第三阶段待实施。范围见[总方案第11节](../../2026-10-19-coastal-clouds-and-stars.md)，最终结果见[机器汇总](acceptance-summary.json)。历史第一阶段和昼夜验收文件均保留。

## 实现

运行改动限于[天空](../../../../src/examples/CoastalSky.ts)与[海面](../../../../src/examples/CoastalOcean.ts)。版本`coastal-clouds-stars-v2`复用原种子17.17与固定云形/星位，将GLSL拆为纯渐变、共享云场、天空星点/光盘和海面过滤反射；参数与源码摘要见[实现记录](implementation.json)。时间快照、日月主光、曝光、IBL、镜面列表/门控、引擎导入与注册均未改变。

- 海面使用相同世界方向与三层密度场，按反射方向屏幕导数和GGX粗糙度抑制高频、拓宽云缘，大足迹收敛到低频覆盖。现有GGX继续负责日月高光，反射函数没有光盘；海雾继续只取`coastalSkyGradient`。
- 粗糙水面逐星贡献先积分为极弱均值，再按粗糙度0.08～0.18平滑消隐。当前水面粗糙度0.20～0.34完全过滤星光；更光滑的函数输入保留10%均值。这是有意抑制星光频带的美术近似，不是精确GGX环境卷积。
- [失败候选诊断](water-quantization.json)显示：直接保留均值时最大单通道差11/255，降至10%后总差异下降但峰值仍为11/255，同一像素为`[13,17,25]`/`[2,17,25]`，恢复差异0；既有`SSAOOriginalSceneColor`输出类型0（8位无符号）。结合这些结果判断是线性场景颜色量化台阶，最终在粗糙水面上消去该残余。没有改后期缓冲或放宽验收条件。

无新增下载素材、网格、材质、纹理、灯、相机或RTT。新增的是现有天空/海面片元计算；未据资源计数推断GPU成本、FPS或加载速度。唐宅尚未实施，本次与其设定/档案无关。

## 工程与统一版本

[187项测试](tests.log)、[类型检查](typecheck.log)、[临时开发构建](development-build.log)、[生产构建与自动发布校验](production-build.log)通过。新增集成测试保护双卫目标的真实天空/海面、无关房间/预览/其他镜面隔离、512²目标与资源不累积；pure独立进程及原测试保持通过。Webpack保留3条既有性能建议。

[runner](run-checks.cjs)的10个套件在[执行记录](run-checks.json)中保存脚本、摘要、退出码和同一最终生产清单摘要。复用历史套件时，其结果中的`baseline`表示套件起源；本轮实际版本以这里的清单摘要为准。测试和诊断不修改所托管的生产代码。

## 八节点画面与GPU反射

[八节点结果](visuals.json)复用[原六视角套件](../day-night-phase4-2026-10-19/check-visuals.cjs)：八个节点均由真实菜单选定，阳台、次卧窗、房外、途中步道、塔前、小电驴共48图；另有四光盘/晨昏交接画面与状态检查。

| 节点 | 阳台 | 房外 | 途中 | 灯塔 |
| --- | --- | --- | --- | --- |
| 00 | [阳台](00-balcony.jpg) | [房外](00-house.jpg) | [步道](00-path.jpg) | [塔前](00-tower.jpg) |
| 03 | [阳台](03-balcony.jpg) | [房外](03-house.jpg) | [步道](03-path.jpg) | [塔前](03-tower.jpg) |
| 06 | [阳台](06-balcony.jpg) | [房外](06-house.jpg) | [步道](06-path.jpg) | [塔前](06-tower.jpg) |
| 09 | [阳台](09-balcony.jpg) | [房外](09-house.jpg) | [步道](09-path.jpg) | [塔前](09-tower.jpg) |
| 12 | [阳台](12-balcony.jpg) | [房外](12-house.jpg) | [步道](12-path.jpg) | [塔前](12-tower.jpg) |
| 15 | [阳台](15-balcony.jpg) | [房外](15-house.jpg) | [步道](15-path.jpg) | [塔前](15-tower.jpg) |
| 18 | [阳台](18-balcony.jpg) | [房外](18-house.jpg) | [步道](18-path.jpg) | [塔前](18-tower.jpg) |
| 21 | [阳台](21-balcony.jpg) | [房外](21-house.jpg) | [步道](21-path.jpg) | [塔前](21-tower.jpg) |

各节点另有`HH-bedroom.jpg`、`HH-scooter.jpg`。由[反射检查](check-reflection.cjs)补齐四方/天顶40图，文件模式`HH-north/east/south/west/zenith.jpg`，例如[正午天顶](12-zenith.jpg)、[午夜西向](00-west.jpg)。覆盖率15%～25%仍是全上半球美术目标，单幅透视图不作为覆盖率测量。

[GPU结果](reflection.json)使用精确共享源码临时诊断材质，测试完恢复/释放；另直接对实际生产海面做现有uniform开关对照：

- 无过滤且关闭星点/光盘时，同方向天空与反射像素相同。云色/星点/光盘改变不影响纯渐变；反射对光盘强度变化保持相同像素，避免重复高光。
- 96个方向的输出角向总变差从5354（零过滤）降至4428（0.1156过滤角），0.65大足迹时为0。这里是诊断画面的像素变化量，不是物理云覆盖、滤波精度或性能指标。
- [正午实际海面](sea-noon-cloud-reflection.jpg)的640×280区域改变云色后61,957像素变化，恢复差异0；[最终午夜海面](sea-midnight-filtered-stars.jpg)星光开/关差异0，保留实际月光高光与云形。
- 月边0～18°以及地平线负高度/0.035～0.20的可见度GPU取样保持单调、地下为0。曝光、日月角度、主光强度与环境照明没有为突出云星而调整。

## 星点连续性与实际DPR

[稳定性结果](stability.json)/[脚本](check-stability.cjs)：Chrome155.0.8059.82、WebKit27.2×1280×800、390×844、844×390×DPR1/2，共12组/96次八节点与156个参考转头/视场缩放帧。每帧用实际星点与权重零的GPU像素差提取亮点，再按真实相机矩阵反投影为世界方向；角面积归一化通量用于判断亚像素亮度变化。

- 相邻帧匹配率最低97.83%，最大方向误差0.000835弧度以内；通量比0.654～1.547，没有整片重新随机或持续放大增亮。
- DPR1/2共有星点匹配率100%，角误差最大0.000582弧度以内。夹具明确设置硬件缩放为`1/DPR`，实际缓冲包括2560×1600、780×1688、1688×780；未把截图放大当作更高渲染分辨率。该设置只在验收夹具中使用，应用默认分辨率策略不变。
- 每组保存0/6/12帧截图，全部13帧的世界方向/通量数据归档；原住宅套件另验证真实拖动和滚轮输入。这些是固定姿态/固定步长的视觉检查，结果限于本轮覆盖的条件，不是FPS或实机录像。

## 双卫镜面与原功能

[云层与遮挡检查](mirror-clouds.json)/[脚本](check-mirrors.cjs)只统计主画面中投影到实体镜片面内的像素，避免把RTT中没有显示在镜面上的区域算成正样本。

- [主卫窗洞](mirror-ensuite-window-clouds.jpg)有7,752云像素变化，恢复差异0；使用反射眼位和原裁切，云只经实际窗洞出现。该夜窗姿态未检出可见星点，记录为未见，不作为镜中某颗星的对齐正样本。
- [公卫闭门墙面](mirror-public-closed-wall.jpg)差异0；公卫没有窗，[开门](mirror-public-open-door.jpg)后继续按实际相邻客厅/门墙遮挡，此姿态也未检出云色变化。没有为获取云星画面放开墙体或扩大反射列表。
- [主卫原动态检查](mirrors/master/mirror-map.json)验证物体隐藏5,119像素变化、恢复原摘要、门/灯/视角与背面/离屏缓存；[公卫动态检查](mirrors/public/public-mirror.json)物体隐藏2,088像素变化，恢复原摘要、关灯变化通过。两张512²局部目标、`noPrePassRenderer`和刷新门控保持。
- [过渡](transitions.json)/[脚本](check-transitions.cjs)的25个50ms参考帧、3次中途改选、0.2秒减少动态效果通过，天空/海面云色与显星参数始终同值。第一人称时间菜单用真实T键打开，等待应用恢复指针与交互提示后再点击实体门。
- [原住宅回归](regression.json)通过8抽屉/8灯/7门、八房碰撞通行、推拉门保护、详情/地图/指针恢复、拖动缩放、设置/Inspector、模型失败隔离与释放。该套件的重复近景截图保留在本次临时目录，不重复归档。

正常浏览器流程错误、告警和404均为零。Firefox/Safari[重新探测](platform-availability.json)分别启动/会话15秒超时；没有改变安全设置。物理设备未使用，WebGL2结果不代替WebGL1或实机结论。

## 字节与交付边界

[发布结果](release-check.json)/[脚本](check-release.cjs)对根路径与`/home/`的495个文件逐一GET/字节/SHA256核对，包含全部动态分包、说明、分析报告和清单自身。[清单](release-manifest.json)与[依赖分析](bundle-analysis.json)固定本轮版本；36运行素材和两目标GLB摘要不变。

| 指标 | 本次 | 较第一阶段 | 较功能建立前 |
| --- | ---: | ---: | ---: |
| 两目标GLB | 4,332,840 B | 0 | 0 |
| 运行素材 / 文件 | 15,867,377 B / 36 | 0 | 0 |
| 静态首屏JS | 2,684,677 B | +1,606 B | +6,443 B |
| 实际首屏含必需异步 / 文件 | 2,903,529 B / 12 | +1,606 B | +6,443 B |
| 完整发布目录 / 文件 | 42,316,300 B / 495 | +1,607 B | +6,444 B |

满足原4.25/16/3/41MiB硬预算与功能24/64KiB增量目标，阈值/白名单/依赖不变。场景670网格/95材质/148纹理/17灯/3相机保持。没有测绘制次数、FPS/GPU、内存/显存或加载耗时，不把新增片元计算称为零成本。

第二阶段完成。第三阶段完整自动/暂停、住宅至塔顶/骑乘往返和三轮重建仍待实施；上述必要原功能回归不提前标为第三阶段收口。受限平台、实机和原暂停性能实验仍未验。

## 复跑

根目录依次执行`npm test`、`npm run typecheck`、`npm run build -- --output-path /private/tmp/babylon-clouds-stars-phase2-dev`、`npm run build:production`。只托管最终目录：`python3 docs/technical-plans/assets/coastal-cliff-d-2026-10-18/serve-dist.py --port 8200 --root <仓库绝对路径>/dist`。

本机现有工具变量为`PLAYWRIGHT_PACKAGE=/private/tmp/dsh-playwright/node_modules/playwright-core`、`PLAYWRIGHT_WEBKIT_EXECUTABLE=/private/tmp/study-audio-test-browsers/webkit-2336/pw_run.sh`、`PLAYWRIGHT_FIREFOX_EXECUTABLE=/private/tmp/study-audio-test-browsers/firefox-1538/firefox/Nightly.app/Contents/MacOS/firefox`、`STUDY_URL=http://127.0.0.1:8200/`。运行本目录`run-checks.cjs`；可带套件名称仅复跑受影响项，已通过且生产包不变的项无需重复。

`verify-evidence.cjs`核对源码/脚本摘要、统一生产清单、画面/像素/矩阵/发布结果后生成汇总。`diagnose-water.cjs`只输出当前版本的另份诊断；历史`water-quantization.json`保留失败候选参数和像素，不覆盖成当前通过结果。测试日志仅清理行尾空白。提交入口：`git log --follow -- src/examples/CoastalOcean.ts`，提交目的“完成白云星空第二阶段反射联动与视觉校准”。
