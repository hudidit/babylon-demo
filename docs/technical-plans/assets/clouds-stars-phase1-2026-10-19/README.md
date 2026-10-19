# 白云与星空第一阶段：天空与时间状态

日期：2026-10-19；输入提交：`bea1db6`。状态：第一阶段已完成，第二、三阶段待实施。范围与取舍见[总方案第10节](../../2026-10-19-coastal-clouds-and-stars.md)。本目录保存当前生产版本的新证据，历史昼夜验收不覆盖、不改写。

## 实现与边界

- `RoomTimeOfDay.ts`保存八节点不可变线性云亮/暗色及显星权重；连续太阳高度−12°至−4°门控，手动直接混合已显示值。跨午夜不随机重排，快速改选不回跳；继续使用原1.2秒/0.2秒与统一自动时钟。
- `CoastalSky.ts`在原天空材质内计算三层连续三维云场和圆盘等面积星点。源码与[实现记录](implementation.json)固定版本`coastal-clouds-stars-v1`、种子17.17、云尺度6.4/阈值0.60、24格/0.18概率/0.00095角半径。云亮暗取主层解析梯度，暖缘只朝太阳方向；星点检查九邻域，在连续映射上求导并做高斯足迹与能量补偿，天空下半球为零。
- 月边抑制取明确月亮方向和淡化强度；云密度遮星并局部削弱日月盘。保留镜像眼位、裁切、原曝光1.12/IBL0.35、主光与注册路径。云星高频函数只进入天空；海面已收到同批参数，反射和海雾继续调用原纯渐变。
- 这是背景薄云与固定星空，无新增素材/渲染资源、云漂、星闪、云影、体积散射或菜单。第二阶段的云星海面反射、双卫镜面与八节点六视角、完整慢转/缩放像素连续性仍待实施；第三阶段完整自动/暂停/路线/重建仍待验收。原性能实验继续暂停。

## 工程与生产浏览器

[测试](tests.log)186项、[类型检查](typecheck.log)、[临时开发构建](development-build.log)、[生产构建及自动发布校验](production-build.log)全部通过。测试覆盖太阳高度门控两侧、白昼严格零、线性云色、跨午夜、显示快照混合/改选、天空海面同值、无资源累积以及pure独立进程；Webpack保留3条既有性能建议。

[Chrome结果](browser.json)与[脚本](check-browser.cjs)使用未修改的独立生产页面，CDP取得已存在RoomScene，真实菜单选点、固定50ms参考步长与相同姿态截图。时钟在截图前冻结；这些帧不用于FPS/GPU或加载耗时结论。

| 节点 | 阳台实景 | 相同天空方向 |
| --- | --- | --- |
| 清晨06 | [阳台](06-balcony.png) | [天空](06-sky.png)、[太阳方向云缘](6-sunward-clouds.png) |
| 正午12 | [阳台](12-balcony.png) | [天空](12-sky.png) |
| 黄昏18 | [阳台](18-balcony.png) | [天空](18-sky.png)、[太阳方向云缘](18-sunward-clouds.png) |
| 午夜00 | [阳台](00-balcony.png) | [天空](00-sky.png) |

四方与天顶另存`00/12-north/east/south/west/zenith.png`。首轮将云软边0.565～0.675收窄到0.58～0.655，提升云亮部和主层明暗；最终画面保持大片晴空。覆盖率15%～25%仍为全上半球美术目标，单张透视截图不当作覆盖率测量。

- 25帧1.2秒过渡的星点权重从0连续升至1；[中点](transition-12.png)对应权重0.5，[终点](transition-24.png)为午夜。改选从实际显示权重续接；减少动态效果中点权重0.5/月抑制0，0.2秒后精确到午夜。
- GPU像素对照只切换现有`skyStarVisibility`并恢复，不修改发布代码。640×360区域午夜有500像素变化、累计正向通道差32,876，恢复后差异0；白昼及下半球为0。说明固定姿态下真实输出和复现通过，不扩大为所有转头/缩放情况已验。
- [矩阵结果](matrix.json)/[脚本](check-matrix.cjs)：Chrome155.0.8059.82、WebKit27.2×1280×800、390×844、844×390×DPR1/2，共12组、48次06/12/18/00检查。真实天空/海面GPU编译、导数能力、触控选点、资源计数与释放通过；每组午夜仰望PNG另存。均使用WebGL2，未据此声明WebGL1或物理设备通过。
- [原住宅回归](regression.json)/[日志](regression.log)复用[既有套件](../lighthouse-finish-2026-10-19/check-regression.cjs)：8抽屉、8灯、7门、八房通行碰撞、近景、推拉门保护、详情/地图/指针恢复、拖动缩放、设置/Inspector、失败隔离和释放通过。历史脚本内`baseline`表示套件起源，当前受验版本由本目录生产清单与[脚本摘要](implementation.json)固定；该套件临时截图未重复归档。该回归不等于本功能双镜面和午夜灯塔全路线验收。

上述正常浏览器流程错误、告警、404均为零。[平台探测](platform-availability.json)/[脚本](check-platforms.cjs)本轮重新尝试：Firefox启动15秒超时并出现sandbox extension/SWGL日志；Safari创建会话15秒超时，未获得可验会话；没有修改安全设置，也未使用物理设备，三者仍未验。

## 字节与独立发布

[发布校验](release-check.json)/[脚本](check-release.cjs)对根路径和`/home/`的495文件逐一GET/字节/SHA256校验，含全部动态Inspector/编辑器分包、来源说明和清单自身。36运行素材摘要与上一版相同；[发布清单](release-manifest.json)、[依赖分析](bundle-analysis.json)与[汇总](acceptance-summary.json)保留本轮版本。

| 指标 | 本次 | 较`12c364a`基线 | 硬上限 |
| --- | ---: | ---: | ---: |
| 两目标GLB | 4,332,840 B | 0 | 4.25 MiB |
| 运行素材 / 文件 | 15,867,377 B / 36 | 0 | 16 MiB |
| 静态初始JS | 2,683,071 B | +4,837 B | 3 MiB |
| 实际首屏JS含必需异步 / 文件 | 2,901,923 B / 12 | +4,837 B | 3 MiB |
| 完整发布目录 / 文件 | 42,314,693 B / 495 | +4,837 B | 41 MiB |

满足方案JS增量24KiB/完整发布增量64KiB目标，无调整白名单、依赖或预算。场景保持670网格、95材质、148纹理、17灯、3相机；既有两张镜面RTT保留。未测绘制次数、FPS/GPU、内存/显存或加载耗时，新增片元计算不称为零成本。

## 复跑

仓库根目录依次执行`npm test`、`npm run typecheck`、`npm run build -- --output-path /private/tmp/babylon-clouds-stars-phase1-dev`、`npm run build:production`。仅托管最终目录：`python3 docs/technical-plans/assets/coastal-cliff-d-2026-10-18/serve-dist.py --port 8197 --root <仓库绝对路径>/dist`。

本目录Node脚本使用`PLAYWRIGHT_PACKAGE=/private/tmp/dsh-playwright/node_modules/playwright-core`、`STUDY_URL=http://127.0.0.1:8197/`；矩阵另设`PLAYWRIGHT_WEBKIT_EXECUTABLE=/private/tmp/study-audio-test-browsers/webkit-2336/pw_run.sh`，平台探测另设`PLAYWRIGHT_FIREFOX_EXECUTABLE=/private/tmp/study-audio-test-browsers/firefox-1538/firefox/Nightly.app/Contents/MacOS/firefox`。依次执行`check-browser.cjs`、`check-matrix.cjs`、`check-platforms.cjs`、`check-release.cjs`；这些路径是本机现有工具，不是新增项目依赖。原住宅套件将`STUDY_CHECK_OUTPUT`设为本次临时目录，复核后把`regression.json`与日志复制到本目录。

`node docs/technical-plans/assets/clouds-stars-phase1-2026-10-19/verify-evidence.cjs`核对当前源码/套件摘要、生产清单、结果、平台边界和预算，再生成机器汇总。源码摘要是本轮已构建版本的固定记录，后续改动应新建验收记录，不能据旧记录声称通过。提交入口：`git log --follow -- src/examples/CoastalSky.ts`，提交目的“实现白云与星空第一阶段天空与时间状态”。
