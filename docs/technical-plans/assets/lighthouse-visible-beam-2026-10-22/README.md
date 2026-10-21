# 夜间可见旋转光束验收

2026-10-22，输入`c9a2807`，对应[方案与结果](../../2026-10-22-lighthouse-visible-beam.md)。交付有限冷白散射光锥和海面亮带，原十秒一圈相位、0.82初始保护面透射、供电/试灯/暂停均保留。提交目的“增强灯塔夜间旋转光束与海面照明”，相关提交通过本目录Git历史定位。

## 结果

- [326项测试](tests.log)、[类型](typecheck.log)、[开发构建](build-development.log)、[生产构建及发布校验](build-production.log)通过。仍有原3项webpack体积建议。
- [Chrome现场结果](after/browser.json)和[脚本](check-browser.cjs)：同一观察机位两方向、步道/住宅远距、海面落点、灯室近景、横竖屏及雾/风雨通过。50个50ms接受帧转过四分之一圈，真实时间菜单暂停冻结、恢复首帧不补算，日间熄灭和试灯透射一致。新套件无运行错误、缺失请求或告警。
- [海面单独受光](after/sea-light-only.jpg)和[禁用受光](after/sea-light-disabled.jpg)用同帧GPU读取比较：约15.4万个通道改变，最大差96/255；空气网格在比较时隐藏。该检查证明海面着色器实际收到主灯光，不把空气叠加当作海面照明。
- [双引擎矩阵](matrix/matrix.json)、[脚本](check-matrix.cjs)：Chrome155/WebKit27.2 × 三视口 × DPR1/2 × 晴夜/雾夜/风雨夜/晴天共48组，通过实际缓冲尺寸、GPU就绪、启停/透射和天气雾密度检查。运行错误与告警为空。
- [原功能回归](regression/regression.json)通过8抽屉、8灯、7门、55段通行、地图/详情/设置/Inspector和原负向资源路径；错误、告警为空。[三轮重建](recreate/recreate.json)释放全部场景资源并核对监听不累积。
- [独立发布](release.json)、[脚本](check-release.cjs)：只托管dist，根和`/home/`各495文件GET/长度/SHA256通过；36运行素材与[输入清单](baseline-manifest.json)一致。[最终清单](release-manifest.json)和[依赖报告](bundle-analysis.json)包含全部动态分包及说明。

[原版同机位](before/sea-side.jpg)与[新版向海光束](after/sea-forward.jpg)展示新增可见散射；原版记录使用其初始旧相位，不作为严格同相位亮度测量。新版各相位由原共享时钟有界推进至目标，不直接赋值私有相位。海面落点及灯室镜头是观察夹具，不能扩展为全程步行或物理设备验收。

## 字节与成本

| 指标 | 输入版 | 本次 | 预算 |
| --- | ---: | ---: | ---: |
| 两目标GLB | 4,332,840 B | 4,332,840 B | 4.25 MiB |
| 运行素材 | 15,867,377 B | 15,867,377 B | 16 MiB |
| 静态初始JS | 2,835,996 B | 2,843,591 B | 3 MiB |
| 实际首屏JS含必需异步 | 3,054,848 B | 3,062,443 B | 3 MiB |
| 完整发布 | 42,502,754 B | 42,510,439 B | 41 MiB |

首屏增加7,595 B，完整目录增加7,685 B，原预算保持。仅增加1网格134顶点/128三角形、1材质，每个可见渲染通道一次绘制和16步片元积分；无新增贴图、灯、RTT、计时器、依赖或注册。场景716网格/575,398顶点，22灯保持。只对海面增加受光，观察视线深度遮挡保留，没有新增沿光源方向的全场景体积阴影。

没有开展FPS、GPU耗时、加载耗时、Firefox/Safari或物理设备实验；WebKit自动化通过不能写成Safari通过。静态图和字节统计不推断性能收益。

## 复现与诊断

运行`npm test`、`npm run typecheck`，开发输出至临时目录后执行`npm run build:production`。使用已有[独立托管脚本](../lighthouse-weather-step3-2026-10-21/serve-dist.cjs)启动最终dist（8254端口）。设置`PLAYWRIGHT_PACKAGE`到可用的Playwright Core入口，再执行本目录`check-browser.cjs`、`check-matrix.cjs`和`check-release.cjs`；WebKit需要匹配客户端的浏览器目录，可用`PLAYWRIGHT_BROWSERS_PATH`指定。本轮客户端位于临时目录，未加入项目依赖。

原功能和重建使用已有[套件适配器](../lighthouse-equipment-step5-2026-10-21/suite-adapter.cjs)，分别传`regression`/`recreate`，设置`STUDY_CHECK_OUTPUT`为本目录对应子目录。保留脚本历史baseline标签，其历史输入不作为本次输入；最终执行记录以本目录清单、发布大小和[证据核对](evidence-check.json)为准。

首轮观察夹具被第一人称边界复位，已改为海岸观察镜头并重新采集原图。积分原型末端伸入水下造成硬洞，改为浪峰上方封口和渐隐后重验。验收脚本先后误把选时后首个恢复帧计作活跃帧、在不同异步调用间读取被清空的GPU缓冲、假设试灯透射率为1；均按原产品规则修正夹具，未放宽运行逻辑。前两类测量失败保留于[恢复帧诊断](diagnostics/resume-first-frame.json)和[异步读像素诊断](diagnostics/asynchronous-pixel-read.json)。最终结果全部重新采集于同一生产包。
