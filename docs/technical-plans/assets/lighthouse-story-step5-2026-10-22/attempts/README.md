# 失败候选与脚本校准

这些记录不计入最终通过。失败运行保留错误、阶段、状态、清单/源码摘要、已走节点数和最后五个目标；重复的全路线采样已在 `run-summary.json` 中明确省略。部分目录保留当时的脚本、截图和日志。当前可重现脚本及通过条件见[证据入口](../README.md)。

| 候选 | 判断及后续处理 |
| --- | --- |
| `door-action-shape` | 测试误以为拾取返回带ID；实际为稳定的动作对象。最终对照实际门网格绑定的动作对象，仍由原生点击执行。 |
| `door-sweep`、`inside-door-sweep-and-real-frame-duration` | 站在真实门扇扫掠范围导致防夹暂停；改为点击后步行退让，等待门扇真实完成。真实渲染帧长不同，24帧不能固定当作1.2秒。未关闭防夹或改位置。 |
| `cabinet-route-and-model-visits` | 测试路线直穿控制柜；改为退到柜前再去梯子。模型夹具未离开面板却把后续读表也算作同处访问，已修正地点输入；不改生产访问缓存。 |
| `initial-keyboard-and-late-save`、`native-keyboard-rebind` | 关闭面板后原生键盘仍在重新绑定；等待实际锁定/控制，再用原生键盘按下，绑定重置后重新按键。无相机位移补偿。 |
| `optional-selector-reindex` | 已读后按钮不再匹配未读选择器，动态集合索引变化。先取稳定材料ID，再按ID点击。 |
| `inside-door-reach` | 从塔内距门过远，射线长度不足；靠近实际门后点击，再退出扫掠范围。 |
| `closed-home-entry-waypoint` | 返回路线先碰到了已经自动关闭的住宅门；改为到门外停止，再原生开门进入。 |
| `blocked-door-action-label` | 防夹提示的动作标签与“打开门”不同；按实际网格绑定动作核实身份，不依赖展示文本猜门。 |
| `open-leaf-desk-waypoint` | 路线目标点落在已打开的书房门扇边缘，改走已验证可通行的门外侧，再到书桌。 |
| `solar-first-resume-frame` | 恢复控制的首帧不计有效时间，100参考帧不足以保证完整5秒；等原生操作完成再继续。该目录的一次真实渲染旅行通过，但不是最终工具版本。 |
| `inside-door-reach/engines.json`、`inside-door-sweep-and-real-frame-duration/engines.json` | 跨引擎脚本曾使用不存在的开场标题、写本地槽后未刷新保存可用状态；改用实际标题和原生先保存，最终Chrome/WebKit均重验。 |
| `solar-return-diagonal` | 面板回塔路线斜切入口平台边缘被真实碰撞挡住；沿已经走通的外出路线原路返回，再正对台阶进门。 |
| `dump-debug-readiness-argument` | 旧脚本直接把 `executeWhenReady.bind` 交给Promise，第二个reject函数被当成 `checkRenderTargets=true`，额外请求3,323 B调试导出分包。改用单参数回调后重跑，不过滤首屏请求；该动态分包仍在完整发布/HTTP验收内。 |
| `recovery-day-standby` | 回充完成已到晴天日间，恢复供电后主灯按日程待机是正确结果；最终同时核对可用性与当时导航需求，不强求日间点亮。 |
| [白天雾中备用档拒绝](fog-backup-restore-rejected/equipment-divergence.json) | 本轮唯一确认的产品缺陷：恢复时天气需求设置晚于维护快照发布，导致合法的白天备用源被误判不一致。生产代码只调整恢复顺序，保留严格校验；新增自动测试及双引擎完整原生存读。 |
| [被排除的柴油候选](rejected-legacy-generator-route/model-fixture.cjs) | 候选模型路线调用保留的旧柴油命令，超出当前玩家入口，虽曾模型通过也不算验收。最终96路线和原生回充检查只用面板/日照/守候/电池复验；燃料和储备保持。 |

未把这些自动化校准误写为玩家已遇到的卡关、产品优化或性能收益。最终记录另在上级目录，只有其通过状态才作为本轮结论。
