# 帧率问题排查记录（不是性能验收）

**用户说明测量期间显示器已关闭，并要求停止测试。以下记录仅用于排查回溯，不能证明屏幕实际显示 FPS、交互流畅度或生产环境稳定 60 FPS。**

测量代码统计 `Scene.onBeforeRenderObservable` 的调用时间，`fps` 字段实际是场景渲染回调频率。`cpuSubmissionMs` 在场景 before/after 回调之间计时，漏掉之前发生的相机更新；`fullCpuMs` 在引擎 begin/end 回调之间计时，包含相机输入和碰撞。GPU timer query 异步采集、按计数器去重，不等同于屏幕呈现时间。截图是浏览器输出的离屏图像。

## 原始文件

| 文件 | 排查条件 |
| --- | --- |
| [native.json](native.json) | 单个书房实例，1791 × 1173，六视角及两种相机运动 |
| [720p.json](720p.json) | 单个实例，已核对画布为 1280 × 720，六视角及运动 |
| [1080p.json](1080p.json) | 单个实例，已核对画布为 1920 × 1080，六视角及运动 |
| [legacy-collisions.json](legacy-collisions.json) | 相同几何及画面，将碰撞候选恢复为原合并渲染子网格列表，供 CPU 排查对照 |
| [capped-30.json](capped-30.json) | 相同静止场景，临时重新设置 `engine.maxFPS = 30`，供限帧原因对照 |
| [native-benchmark.jpg](native-benchmark.jpg)、[1080p-benchmark.jpg](1080p-benchmark.jpg) | 当时浏览器离屏输出，面板数字是渲染回调频率，不是亮屏验收证据 |
| [benchmark.ts.txt](benchmark.ts.txt) | 临时采样实现参考，未接入最终应用；用户要求停止后不再运行 |

各视角预热 60 个渲染回调，再记录 240 个回调；帧间隔共有 239 个。浏览器为 Chrome 155 / WebGL2，驱动标识为 Apple M6 Metal，设备像素比为 2，硬件缩放为 1；这些条件不能替代显示状态和目标设备验收。

早期多窗口同时渲染、视口覆盖作用于其他窗口的样本未列为分辨率验收记录。以上后续记录已固定单一场景及实际画布尺寸，但显示器关闭这一条件仍使其不能承担实际显示性能验收。

主方案见 [书房帧率修复与性能验收方案](../../2026-10-15-room-frame-rate.md)。亮屏性能待验收，原始数据保留，不继续自动测试。
