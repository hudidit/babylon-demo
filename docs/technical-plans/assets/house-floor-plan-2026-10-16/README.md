# 全屋户型图验收记录

日期：2026-10-16。代码基线：`c1e6961`。对应[技术方案](../../2026-10-16-house-floor-plan.md)。最终图按用户反馈取消独立过廊，入户直接进入客厅；主卧25.9m²、书房10.2m²，主卫只通主卧，主卧外公卫通客厅。

## 图与实现

- [独立户型SVG](floor-plan.svg)、[桌面大图](map-desktop.jpg)、[右下角小图](minimap-desktop.jpg)、[漫游房间高亮](map-first-person.jpg)。
- [手机竖屏](map-portrait.jpg) / [竖屏尺寸清单](map-portrait-dimensions.jpg)、[手机横屏](map-landscape.jpg) / [横屏尺寸清单](map-landscape-dimensions.jpg)、[小屏320×568](map-small-phone.jpg)。
- [手机小图](minimap-portrait.jpg)、[横屏小图](minimap-landscape.jpg)检查与视角条互不覆盖，全部视角可横向滚动访问。
- SVG、尺寸清单与面积来自唯一的[户型数据](../../../../src/examples/HouseFloorPlan.ts)。八个房间、八个连接开口，无新增素材或三维房间。

初稿沿用原8×8m书房及横向过廊；最终采用10.8×10.8m室内范围、右侧客厅中心交通、西北主卧/西南次卧、北侧书房/厨房、两卫相邻和南侧阳台。总规划地面124.74m²，含阳台8.1m²，未扣墙厚。已有三维尺寸暂未改造，因此只高亮实际所在书房/客厅，不提供错误的精确坐标。

## 工程与浏览器

- [63项测试](tests.log)、[类型检查](typecheck.log)、[开发构建](development-build.log)、[生产构建与自动发布校验](production-build.log)。几何测试保护不重叠、真实门洞边界、连通性和用户指定的房间访问归属，不改三维碰撞测试。
- [地图浏览器记录](browser.json)与[复现脚本](check-map.cjs)：点击/M、Tab焦点限制、键鼠/滚轮隔离、视角切换保护、按钮与ESC返回、第一人称移动后保留姿态/锁定恢复、拒绝后重试、两房高亮、设置与信件防嵌套、重复开关资源数量不变。
- [原场景交互回归](regression-browser.json)：八抽屉、三灯、连通门双向通行/动态碰撞/扫掠保护、视角、缩放、设置、Inspector。网格145、材质64，与基线相同。
- [信件查看回归](inspection-browser.json)：横竖屏、相机/共享资源、输入隔离、第一人称返回和重复开关清理。
- 全部最终发布文件通过独立托管GET/SHA256检查，包括清单自身和未触发的动态调试分包；[发布清单](release-manifest.json)与[初始模块分析](bundle-analysis.json)保留。

## 资源与测量边界

[资源对比](resource-changes.json)记录前后原始字节。30个运行素材及摘要保持不变，运行素材14.97 MiB，目标GLB4.13 MiB；初始静态JS与实际首屏JS均小于3 MiB，完整发布小于41 MiB。实际首屏包含必需异步和音频预热，不将主文件视为全部首屏。

使用本机Chrome、DPR1、禁用缓存；无运行/着色器错误或404，构建有三类既有Webpack建议告警。截图用手动render和固定动画delta检验状态，不是FPS、CPU/GPU或加载耗时实验。未实测其他浏览器；未生成新房间，未调整三维书房/客厅尺寸。

## 复现

先执行`npm test`、`npm run typecheck`、`npm run build`，再执行`npm run build:production`。开发构建也可用`npm run build -- --output-path /tmp/house-floor-plan-dev`，避免覆盖已验收的dist。

独立托管最终目录：

```sh
python3 -m http.server 8098 --bind 127.0.0.1 --directory dist
```

另一个终端运行（本机使用已安装Playwright 1.62.1和Google Chrome，可替换模块路径）：

```sh
PLAYWRIGHT_PACKAGE=/path/to/playwright node docs/technical-plans/assets/house-floor-plan-2026-10-16/check-map.cjs
PLAYWRIGHT_PACKAGE=/path/to/playwright STUDY_URL=http://127.0.0.1:8098/ STUDY_CHECK_OUTPUT=/tmp/house-floor-plan-regression node docs/technical-plans/assets/painted-walls-2026-10-16/check-browser.cjs
PLAYWRIGHT_PACKAGE=/path/to/playwright STUDY_URL=http://127.0.0.1:8098/ STUDY_CHECK_OUTPUT=/tmp/house-floor-plan-inspection node docs/technical-plans/assets/item-inspection-2026-10-16/check-inspection.cjs
```

将后两个输出中的浏览器JSON保存到此目录即可复核原交互；其余原场景截图为临时回归证据，不进入运行发布目录。
