# 电驴路肩误停复查

输入提交 `4832e08`，2026-10-23。实现、取舍与边界见[技术方案](../../2026-10-23-scooter-ground-contact.md)。

- `before-scan.json`：修复前道路及两侧路肩拒绝的34个样本站位。`before-contact.json`、`ground-probe.cjs`：对应实际车轮纵/横倾、完整车身起伏；地形/道路在本次保持。测试夹具 `tests/fixtures/scooter-ground-before.json` 另保留旧控制器连续驾驶的停止记录与19个应恢复的站位。
- `probe.cjs`、`scan.json`：当前扫描2,765个样本站位，余15个拒绝，均为住宅/观景长凳等真实外廓接触；原19个地面误判已恢复。脚本的 `reasons` 用旧阈值重放第一条原因以便对照；其中观景平台一个旧“tilt”样本在放宽旧门槛后仍接触长凳，不能把旧第一条原因当成当前拒绝原因。该长凳站位在测试中明确保持拒绝。
- `tests.log`：411测试通过。新增19处双向支撑、3段路肩×2方向×3时步×2起速的36次连续驾驶，以及长凳/建筑/设备/护栏/缺地的保留阻挡。`typecheck.log`、`development.log`、`production.log`：类型/开发/生产及发布通过，Webpack保留3条体积建议。
- `check-route.cjs`、`route-check.json`：真实控制器全线连续积分往返，每程约185.64/185.68米，途中不改位置/朝向，自动引导仅选方向、油门、刹车。终点按现有制动距离提早刹车；25.83/23.98秒是1/60秒积分模拟时长，不是浏览器旅行时长或性能样本。
- `drive-fixture.cjs`、`fixture-webpack.cjs`：同源码独立站位夹具，只在各段开始设定位置/朝向，提供只读诊断与指路角度；不修改delta、引擎时钟、生产输入处理器或碰撞。`browser.json`：Chrome原生系统W/空格+实际指针锁定，住宅去返分别通过6.899/6.807米，后半程4.943米；护栏与塔基分别在x=15.0799、y=85.0199正常停车并有支撑。nativeEvents包含最初后台未锁鼠的测试按键，行驶证据只来自原生窗口激活并锁鼠后的各段；未伪造锁定。
- `home-outbound.jpg`、`home-return.jpg`、`late-shoulder.jpg`、`guardrail-blocked.jpg`、`tower-blocked.jpg`：正常渲染后的实际画面；停驶截图是在按原生空格刹停后保存，诊断中的0km/h不代表途中误停。图中QA工具不进入生产目录。
- `network.jsonl`、`requests-summary.json`：最终生产根页面12个实际首屏JS请求，含必需异步共3,145,643B，预算余85B。`release-check.json`：496文件，静态初始JS2,926,791B、完整目录42,655,504B；相对输入各减少27B，下载素材/模型保持。
- `check-hosted.cjs`、`hosted-check.json`：仅从最终dist托管，根路径与/home/各496文件GET/长度/SHA256一致。`sources.json`：运行改动、测试及回归夹具源码SHA256。

复跑：`npm test`、`npm run typecheck`、`npm run build`、`npm run build:production`；运行 `node docs/technical-plans/assets/scooter-ground-2026-10-23/check-route.cjs` 和 `probe.cjs`。浏览器夹具用同目录 `fixture-webpack.cjs` 编译至 `/private/tmp/scooter-ground-fixture`，`serve.cjs` 将8780指向dist、8781指向夹具（素材只来自dist）。首次打开Chrome后激活专用标签页，点击QA起点，再原生单击画布取得真实锁定，用W驾驶、空格停车。

浏览器驾驶夹具及最终生产根页面日志无错误/告警。浏览器扩展后台点击未取得鼠标锁定，改为原生窗口激活后复验；一次创建生产标签页的CDP超时在既有标签页恢复，不视为应用错误。未进行全程浏览器原生往返、其他浏览器、物理设备、Inspector、FPS或加载耗时测量。

提交目的：`修复电驴在住宅路肩的地面误停`，通过本目录Git历史定位。
