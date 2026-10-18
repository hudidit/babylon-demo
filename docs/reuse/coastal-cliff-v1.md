# 海岸八房v1稳定基线

日期：2026-10-18。对应[海边悬崖阶段D](../technical-plans/2026-10-17-coastal-cliff-exterior.md)和[本轮验收](../technical-plans/assets/coastal-cliff-d-2026-10-18/README.md)。这是当前海岸运行代码的独立快照；原[森林八房v1](README.md)保留，通用SDK/多实例房型尚未实施。

| 项目 | 固定身份 |
| --- | --- |
| 运行源码提交 | `d1ae3a1b9db2bf448284c90cad4dfabd41d25afa` |
| 源码标签 | `scene-baseline/2026-10-18-coastal-cliff-v1` |
| 基线 | [137输入、495文件与工具链](baselines/2026-10-18-coastal-cliff-v1.json) |
| 资产 | [36运行素材、8原始音频和迁移边界](coastal-asset-inventory.json) |
| 完整发布 | 42,203,792字节（40.25MiB），含全部动态分包、来源/许可/清单 |
| 本机归档 | [2026-10-18-coastal-cliff-v1-dist.tar.gz](../../artifacts/reuse-baselines/2026-10-18-coastal-cliff-v1-dist.tar.gz)，21,445,986字节 |
| 归档SHA256 | `b1c9995733a857c78321d00d40c8b30704aa15ba47db69a07c67de5a96e660c7` |

源码包含连续悬崖/PBR草石、动态海面与岸线泡沫，也包含C后已提交的次卧南向海窗、半透明全景、第一人称提速/家具跳跃与走下修复、窗框深度冲突修复。准备提交只增加只读校验选择、测试/清单及文档证据，未修改运行代码；工具/新元数据不与运行标签形成循环依赖。

Chrome155和WebKit26.5的桌面/手机尺寸及DPR1/2模拟、完整Chrome交互/55段路线、真实指针锁定、双卫镜面和发布校验通过。Firefox在本机无法建立会话，Safari需要用户开启远程自动化，物理移动设备没有实测证据；均保持未验。该快照冻结代码和已知限制，不代表所有平台验收完成。海面仅反射天空/太阳，泡沫/水深采用静态岸线近似；不包含真实流体、户外漫游或海浪音效。

36素材共15,867,631字节，原29个室内/音频素材及B的七个海岸交付文件保留摘要；三项历史素材（古董柜、书架、装饰画）仍为`unverified`，不能继承海岸CC0声明。六张扫描图按原记录保留sRGB颜色、线性OpenGL法线及ARM通道；程序天空、地形、海面/生成纹理为项目代码资产，GPU成本另计。公共库迁移仍需布局/实例ID/状态隔离改造。

在包含本次准备工具和元数据的仓库运行：

```sh
node tools/verify-reuse-baseline.cjs --baseline docs/reuse/baselines/2026-10-18-coastal-cliff-v1.json
node tools/verify-reuse-baseline.cjs --baseline docs/reuse/baselines/2026-10-18-coastal-cliff-v1.json --release dist --archive artifacts/reuse-baselines/2026-10-18-coastal-cliff-v1-dist.tar.gz
```

不带`--baseline`仍选择原森林v1，不自动刷新或修复清单。新基线增加缺失/同长度篡改/额外文件/路径穿越/符号链接/错误归档等已有防护之外的选择测试；新版本不能覆盖现有清单和标签。

独立恢复源码（目录自行选择，保留当前工作区）：

```sh
git clone --branch scene-baseline/2026-10-18-coastal-cliff-v1 --single-branch git@github.com:hudidit/babylon-demo.git ../babylon-coastal-v1
cd ../babylon-coastal-v1
npm ci
npm test
npm run typecheck
npm run build -- --output-path /tmp/coastal-v1-development
npm run build:production
```

运行标签包含当时的旧校验工具；应从保存本次准备元数据的原仓库校验恢复目录：

```sh
node tools/verify-reuse-baseline.cjs --baseline docs/reuse/baselines/2026-10-18-coastal-cliff-v1.json --root ../babylon-coastal-v1
```

本轮实际完成本机独立Git克隆/检出、137输入/36素材核验和完整归档解包后的495文件摘要检查。没有在恢复目录重新安装依赖/构建，也不承诺不同工具链下构建逐字节相同。精确恢复成品需先验证归档SHA256，解包到新的空目录，再将`--release`指向其中`dist`；参考[恢复结果](../technical-plans/assets/coastal-cliff-d-2026-10-18/archive-restore-verification.json)。

归档当前只在本机保存，不进入运行白名单或Git；远端保存运行源码标签、准备提交、输入/发布摘要和许可说明，新克隆不会自动包含二进制归档。异地制品备份、实机听感、受限平台及暂停的FPS/加载耗时实验仍是独立未完成事项。
