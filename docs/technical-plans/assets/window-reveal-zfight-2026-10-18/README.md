# 窗框与墙洞交接面深度冲突验收（2026-10-18）

对应[技术方案](../../2026-10-18-window-reveal-zfighting.md)，代码基线 `e19c9b3`。本目录保存修复前后的第一人称画面、调试材质对照、像素探针和场景指标。

## 结论

- 次卧左窗洞侧壁探针（21个相机位置 × 11个深度采样点）中，修复前读到 **19～23** 个窗框木色像素（本目录最后一次记录为19个），修复后 **0** 个。
- 六窗第一人称正视、斜视、仰视和近窗画面不再出现窗框与墙面交替闪烁；可见窗框、玻璃、窗台、窗帘和窗外景观保持。
- 浏览器无运行/着色器错误、警告或404；网格612、材质80、纹理147、灯16、相机3不变；压条去掉倒角后顶点数509,239→504,631（-4,608）。
- 121项测试、类型检查、生产构建和自动发布校验通过；实际首屏JS 2,805,869→2,805,907字节（12个JS，2.68MiB），完整发布42,203,754→42,203,792字节，预算保持。
- 未测FPS、加载耗时或显存；固定相机、像素探针和截图只作画面/功能证据。

## 画面

修复前：窗洞侧壁与顶部出现墙面/窗框交替色和红绿斑点（调试材质：墙面绿、`darkWood`窗框红、其他木色黄）：

- [左窗洞侧壁](before/debug-bedroom-left.jpg)
- [窗洞顶部](before/debug-bedroom-top.jpg)
- [斜视近窗](before/debug-bedroom-graze.jpg)
- [正视](before/debug-bedroom-front.jpg)

修复后：同一相机位置的交接面稳定为墙面，窗框贴脸仍在洞口外侧：

- [左窗洞侧壁](after/debug-bedroom-left.jpg)
- [窗洞顶部](after/debug-bedroom-top.jpg)
- [斜视近窗](after/debug-bedroom-graze.jpg)
- [正视](after/debug-bedroom-front.jpg)

正常材质的第一人称六窗与次卧近景：

- 修复前：[主卧](before/normal-master-front.jpg)、[书房](before/normal-study-front.jpg)、[厨房](before/normal-kitchen-front.jpg)、[主卫](before/normal-ensuite-front.jpg)、[客厅](before/normal-living-front.jpg)、[次卧](before/normal-bedroom-front.jpg)、[次卧斜视](before/normal-bedroom-left.jpg)、[次卧仰视](before/normal-bedroom-top.jpg)、[次卧竖屏](before/normal-bedroom-portrait.jpg)、[次卧横屏](before/normal-bedroom-landscape.jpg)
- 修复后：[主卧](after/normal-master-front.jpg)、[书房](after/normal-study-front.jpg)、[厨房](after/normal-kitchen-front.jpg)、[主卫](after/normal-ensuite-front.jpg)、[客厅](after/normal-living-front.jpg)、[次卧](after/normal-bedroom-front.jpg)、[次卧斜视](after/normal-bedroom-left.jpg)、[次卧仰视](after/normal-bedroom-top.jpg)、[次卧竖屏](after/normal-bedroom-portrait.jpg)、[次卧横屏](after/normal-bedroom-landscape.jpg)

> 普通截图中的窗外海面为共享动画资源，修复前后加载时刻不同会造成窗外像素差异；窗框判断以调试材质、固定相机位置和像素探针为准。

## 指标

| 指标 | 修复前 | 修复后 |
| --- | ---: | ---: |
| 左窗洞侧壁窗框色采样点 | 19～23 | 0 |
| 场景网格 | 612 | 612 |
| 场景顶点 | 509,239 | 504,631 |
| 材质 / 纹理 / 灯 / 相机 | 80 / 147 / 16 / 3 | 80 / 147 / 16 / 3 |
| 静态初始 JS | 2,587,017字节 | 2,587,055字节 |
| 实际首屏 JS（12个） | 2,805,869字节 | 2,805,907字节 |
| 完整发布 | 42,203,754字节 | 42,203,792字节 |
| 运行素材 / 两目标 GLB | 不变 | 不变 |

浏览器：Chrome 155.0.8059.82，1280×800，DPR1；横竖屏检查使用同一浏览器。修复前的静态/实际首屏 JS 与完整发布字节来自上一提交基线，修复后为本次生产构建/浏览器请求实测。

原始输出：

- [修复前 metrics](before/metrics.json)
- [修复后 metrics](after/metrics.json)

工程证据：[121项测试](tests.log)、[类型检查](typecheck.log)、[生产构建与自动发布校验](production-build.log)。

## 复现

1. 准备修复前生产目录（例如上一提交的`dist`）和本次`dist`，分别用独立静态服务器托管。本文记录使用 8122（修复前）和 8123（修复后）。
2. 指定 Playwright 包、页面地址和输出目录运行检查脚本：

```bash
# 修复前：只采集，不要求探针为0
PLAYWRIGHT_PACKAGE=/path/to/playwright \
STUDY_URL=http://127.0.0.1:8122/ \
STUDY_CHECK_OUTPUT=$PWD/docs/technical-plans/assets/window-reveal-zfight-2026-10-18/before \
STUDY_EXPECT_FIXED=0 node docs/technical-plans/assets/window-reveal-zfight-2026-10-18/check-reveal.cjs

# 修复后：要求侧壁探针中无窗框色
PLAYWRIGHT_PACKAGE=/path/to/playwright \
STUDY_URL=http://127.0.0.1:8123/ \
STUDY_CHECK_OUTPUT=$PWD/docs/technical-plans/assets/window-reveal-zfight-2026-10-18/after \
STUDY_EXPECT_FIXED=1 node docs/technical-plans/assets/window-reveal-zfight-2026-10-18/check-reveal.cjs
```

3. 脚本会停止渲染循环后固定第一人称相机，避免动画和输入影响；正常材质截图后，把墙面/`darkWood`/`wood`/玻璃换成无光照调试色，在21个横向相机位置、11个侧壁深度点上用`gl.readPixels`读回颜色并分类。`STUDY_EXPECT_FIXED=1`时同时检查运行错误、请求失败和3MiB首屏JS预算。

本次代码、测试、方案和本目录证据随“修复第一人称窗框与墙面闪烁”提交推送，标识见 Git 历史。
