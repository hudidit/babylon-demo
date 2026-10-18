# 灯塔海岸v1稳定基线

日期：2026-10-18。对应[灯塔方案A～D](../technical-plans/2026-10-18-lighthouse-coastal-path.md)及[D验收](../technical-plans/assets/lighthouse-d-2026-10-18/README.md)。本快照包含可步行到达的灯塔、沿海步道、最终饰面/屋顶/缓存局部阴影，以及入户门向屋外打开修正；原[海岸v1](coastal-cliff-v1.md)和森林v1保持原样。

| 项目 | 固定身份 |
| --- | --- |
| 运行源码提交 | `2581be579f8042c0b7d74b214011f38d4b6c10e8` |
| 源码标签 | `scene-baseline/2026-10-18-lighthouse-coast-v1` |
| 基线 | [146输入、工具链、495发布文件](baselines/2026-10-18-lighthouse-coast-v1.json) |
| 资产与迁移入口 | [36运行素材、8原始音频、程序生成资源](lighthouse-asset-inventory.json) |
| 完整发布 | 42,239,250字节（40.28MiB），含全部动态分包、许可/来源/清单 |
| 本机归档 | [2026-10-18-lighthouse-coast-v1-dist.tar.gz](../../artifacts/reuse-baselines/2026-10-18-lighthouse-coast-v1-dist.tar.gz)，21,460,730字节 |
| 归档SHA256 | `470d41c17c73dafb949c9feb9f803c21a62a67c531161d482fd09bbd14ed423e` |

D只增加交付文档、清单和验收脚本/证据，未改变运行代码或构建配置。标签冻结运行版本；D准备提交通过本文件的Git历史查找，避免将快照元数据与其自身摘要循环绑定。默认校验器仍选择森林v1，新基线必须显式指定：

```sh
node tools/verify-reuse-baseline.cjs --baseline docs/reuse/baselines/2026-10-18-lighthouse-coast-v1.json
node tools/verify-reuse-baseline.cjs --baseline docs/reuse/baselines/2026-10-18-lighthouse-coast-v1.json --release dist --archive artifacts/reuse-baselines/2026-10-18-lighthouse-coast-v1-dist.tar.gz
```

在独立目录恢复源码，保留当前工作区：

```sh
git clone --branch scene-baseline/2026-10-18-lighthouse-coast-v1 --single-branch git@github.com:hudidit/babylon-demo.git ../babylon-lighthouse-v1
cd ../babylon-lighthouse-v1
npm ci
npm test
npm run typecheck
npm run build -- --output-path /tmp/lighthouse-v1-development
npm run build:production
```

回到包含D元数据的原仓库，检查恢复结果：

```sh
node tools/verify-reuse-baseline.cjs --baseline docs/reuse/baselines/2026-10-18-lighthouse-coast-v1.json --root ../babylon-lighthouse-v1 --release ../babylon-lighthouse-v1/dist
```

本轮实际从本机Git标签独立克隆，146输入/36素材通过；使用现有锁定依赖的目录内副本重新生产构建，495文件逐字节一致，见[恢复构建记录](../technical-plans/assets/lighthouse-d-2026-10-18/source-rebuild-comparison.json)。没有执行新的`npm ci`联网安装，不承诺其他工具链/平台的逐字节重现。先前外部`node_modules`符号链接让Webpack模块路径/分包编号变化；本地依赖副本消除了差异，不应以外部符号链接代替标准恢复。macOS检出还报告旧示例`Barrel.glb`/`barrel.glb`大小写冲突；二者均不在本快照运行白名单内，不影响已核验输入，不承诺全部历史示例资产在大小写不敏感卷上无损检出。

需要精确成品时，先用上面的`--archive`核对归档，再解包到新的空目录：

```sh
mkdir /tmp/lighthouse-v1-frozen-release
tar -xzf artifacts/reuse-baselines/2026-10-18-lighthouse-coast-v1-dist.tar.gz -C /tmp/lighthouse-v1-frozen-release
node tools/verify-reuse-baseline.cjs --baseline docs/reuse/baselines/2026-10-18-lighthouse-coast-v1.json --release /tmp/lighthouse-v1-frozen-release/dist
python3 -m http.server 8081 --bind 127.0.0.1 --directory /tmp/lighthouse-v1-frozen-release/dist
```

本轮实际解包后495文件精确集合/摘要通过。归档只存本机，未进入Git或运行白名单；远端源码标签和清单不能代替异地二进制备份，新克隆不会自动取得该归档。

141项测试、类型/开发/生产构建、Chrome/WebKit十二个尺寸/DPR组合、Chrome真实往返/外开门、原室内交互/双镜面、失败降级和重复创建/销毁通过。实际首屏含必需异步JS为2,836,207字节，预算保持。Firefox启动失败、Safari会话超时、物理设备未验；WebKit模拟检查不代表Safari或完整指针锁定键盘漫游验收。隐藏恢复含合成visibility事件，不代替实机后台实验。

194.07米有限步道不包含塔内/登塔、夜景灯束、独立小电驴或通用SDK。海水仍是天空/太阳反射及静态岸线近似。三项历史素材（古董柜、书架、装饰画）保留`unverified`，迁移前补齐授权或替换。512²生成岸线场为1MiB（无mip），一个1024²缓存阴影不代表整条路线同时高精度覆盖；本轮没有FPS、GPU耗时、峰值显存、加载耗时或物理音效听感结论。
