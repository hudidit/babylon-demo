# 灯塔第三阶段验收记录（2026-10-19）

基线`c77c7d2`，实施范围见[第三阶段方案](../../2026-10-19-lighthouse-interior-finish.md)。本目录保留可复跑脚本、实际浏览器请求/状态与画面；功能采样不包含FPS或加载耗时实验。

## 交付内容与来源

首层增加配电面板/工作灯开关、工具板/工具/线缆卷和可查看的维护记录；五层增加实体英文标牌和防护工作灯，顶层增加透镜环、底座、保护框和线缆。记录为原创虚构条目，明确标注`FICTIONAL SCENE LOG`，不指代真实灯塔历史或检修记录。中文交互提示及地图说明对应其用途。

`LighthouseRecords.ts`生成1024×512 RGBA图集（2,097,152字节原始像素），共用记录和五层标牌，不请求字体或图片。几何、图集及三个新增材质均为项目原创；其余材质、36下载素材及许可状态保持。工作照明开关复用已有CC0开关声音，记录查看/返回复用翻纸声，使用既有音量/静音、空间声及后台停止管理。

局部工作照明为一个白名单内的向下聚光源，随当前楼层移动；塔外/隐藏/后台停用，五层灯具共用开关。3.4米有效距离和向下光锥避免照穿上下楼板，外壳、玻璃、海岸、住宅不在照明名单；无新增阴影图、RTT、相机或后期。晴朗午后及主灯日间待机保留，不包含独立昼夜方案。

地图海岸页增加五层剖面，使用实际楼面高度与层名，橙色标记对应当前高度，层背景对应当前停靠楼层；梯中高度不冒充停靠楼层。剖面仅为导航，不传送、不移动玩家。

## 工程与资源

[tests.log](tests.log)：166项测试通过；[typecheck.log](typecheck.log)、[development-build.log](development-build.log)、[production-build.log](production-build.log)通过。开发输出在`/tmp/lighthouse-finish-development`，正式`dist`通过自动发布校验。

| 指标 | `c77c7d2` | 本次 | 变化 / 预算 |
| --- | ---: | ---: | --- |
| 两个GLB | 4,332,840 B | 4,332,840 B | 不变 / ≤4.25 MiB |
| 运行下载素材（36） | 15,867,631 B | 15,867,631 B | 不变 / ≤16 MiB |
| 静态初始JS | 2,649,623 B | 2,659,755 B | +10,132 B / ≤3 MiB |
| 实际首屏JS（含必需异步） | 2,868,475 B | 2,878,607 B | +10,132 B / ≤3 MiB |
| 完整发布（495文件） | 42,272,518 B | 42,283,079 B | +10,561 B / ≤41 MiB |

场景：670网格/570,475顶点、95材质/148纹理/17灯/3相机；较基线新增9合批网格/2,718顶点、3材质、1生成纹理和1灯。第二阶段楼层/梯子仍为6合批/3,264顶点，旧外景分类预算保持；新陈设单列，不借用旧外景160,000顶点目标。图集像素显存成本与下载素材字节分开列出，不把新增纹理写成零成本。

[check-release.cjs](check-release.cjs) / [release-check.json](release-check.json)：只托管最终`dist`，根路径与`/home/`全部495文件大小/SHA256一致，全部动态调试分包、来源/许可和清单均纳入。旧森林/其他示例路径404，不能由public兜底；36下载素材与历史交付摘要相同。[release-manifest.json](release-manifest.json)及[bundle-analysis.json](bundle-analysis.json)保存最终清单/模块图。

## 浏览器验收

- [finish.json](finish.json) / [check-finish.cjs](check-finish.cjs)：Chrome真实左键开关照明、维护记录查看/返回（横竖屏）及原姿态恢复；记录两次开关、查看/返回两次翻纸声音。逐层光源位置/白名单、五层地图高亮/高度标记与返回姿态、回到住宅后灯光停用和重复释放通过。
- [journey.json](journey.json) / [check-journey.cjs](check-journey.cjs)：一次住宅入户内初始定位后，真实W键沿139个步道控制点到塔外，点击塔门，逐层上下/每层离梯看窗、绕外廊一圈，再经139控制点返回住宅。途中没有位置/高度校正；相机仅转向，参考时间步50ms，仅计功能，不计旅行耗时/FPS。保留梯中地图、设置/ESC/预设恢复及梯上禁止横移/跳跃等检查。
- [engines/matrix.json](engines/matrix.json) / [check-matrix.cjs](check-matrix.cjs)：Chrome / WebKit × 1280×800、390×844、844×390 × DPR1/2，共12组合/36图；维护近景、三层窗景和顶层透镜、材质就绪及重复释放通过。WebKit只做镜头夹具，未冒充真实锁鼠登塔。
- [screenshot-qa.json](screenshot-qa.json) / [check-screenshots.py](check-screenshots.py)：36图场景区域非空白检测通过；另外视觉检查记录正文/横竖屏详情、楼层地图、Chrome窗口及WebKit维护/透镜。阈值只排除空帧，不是画质或性能评分。
- [regression.json](regression.json) / [check-regression.cjs](check-regression.cjs)：住宅8抽屉/8灯/各门、55段原通路、地图/信件/设置/拖动缩放、Inspector、释放和加载失败降级通过，28个总交互（原25+塔门+开关+记录）。
- [subpath.json](subpath.json) / [check-subpath.cjs](check-subpath.cjs)：`/home/`的地图/回家/Inspector通过，首屏及按需JS请求全部位于子路径，实际首屏2,878,607字节（12JS，含必需异步）。
- 双卫镜面像素/门灯变化分别保存在[主卫记录](mirrors/master/mirror-map.json)和[公卫记录](mirrors/public/public-mirror.json)，脚本为[check-map-mirror.cjs](check-map-mirror.cjs)、[check-public-mirror.cjs](check-public-mirror.cjs)。

## 复跑与边界

本机通过`../coastal-cliff-d-2026-10-18/serve-dist.py --port 8186 --root <仓库绝对路径>/dist`独立托管。Node脚本使用`PLAYWRIGHT_PACKAGE=/tmp/dsh-playwright/node_modules/playwright-core`、`STUDY_URL=http://127.0.0.1:8186/`；矩阵另设`PLAYWRIGHT_WEBKIT_EXECUTABLE=/tmp/study-audio-test-browsers/webkit-2336/pw_run.sh`。这些为本机验收工具，不进入项目依赖或发布。Pillow检查使用应用自带Python。浏览器和全部文件摘要校验按顺序运行，避免本机HTTP服务在并发验收流量下出现连接重置；发生重置的两次无效启动已串行重跑，没有改动发布包或隐藏请求。

可复跑脚本以本目录为输出位置；镜面脚本输出使用环境变量指定到本目录的`mirrors/master`、`mirrors/public`。截图须启用正常渲染循环、等待合成后采集，空白检测与人工视觉检查分别记录。首次检查发现记录/标牌绕序反向及首层层号牌遮挡夹板，已修正朝向、将首层牌抬高，并增加面法线测试；失败的梯井内开关镜头夹具改到柜前北侧可步行位置，避开梯前抓梯优先区域。验收脚本的原26交互计数更新为新增开关/记录后的28，没有放松运行安全边界。

Firefox、Safari及物理移动设备本轮未验；跨引擎视口矩阵不等于真实设备或WebKit完整键盘漫游。主观声音听感未作实机确认。暂停的FPS、加载耗时及眩晕实验不恢复，不从几何/字节/截图推断相关收益。
