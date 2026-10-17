// Window reveal z-fighting check. Deterministic camera poses and WebGL pixel probes only;
// this is not an FPS or load-time measurement.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");

const output = process.env.STUDY_CHECK_OUTPUT || path.join(__dirname, "run");
const expectFixed = process.env.STUDY_EXPECT_FIXED === "1";
const url = process.env.STUDY_URL || "http://127.0.0.1:8123/";

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [], warnings = [], requests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
    if (message.type() === "warning") warnings.push(message.text());
  });
  page.on("response", response => requests.push({ url: response.url(), status: response.status(), bytes: Number(response.headers()["content-length"] || 0) }));

  const render = () => page.evaluate(() => { for (let i = 0; i < 4; i++) s.render(); });
  const shot = async name => {
    await render();
    await page.screenshot({ path: path.join(output, name + ".jpg"), type: "jpeg", quality: 88 });
  };
  const pose = (position, target, yawOffset = 0) => page.evaluate(({ position, target, yawOffset }) => {
    const camera = s.activeCamera, V = camera.position.constructor;
    const world = ([x, y, h]) => new V((x - 5.4) * 5, -5 + h * 5, (y - 5.4) * 5);
    camera.cameraDirection.setAll(0); camera.cameraRotation.setAll(0);
    camera.position.copyFrom(world(position)); camera.setTarget(world(target));
    camera.rotation.y += yawOffset;
    camera.getViewMatrix(true); camera.getProjectionMatrix(true);
    for (let i = 0; i < 4; i++) s.render();
  }, { position, target, yawOffset });

  try {
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(() => document.querySelector("#scene-status").textContent.includes("全屋八个房间已布置"));
    await page.waitForFunction(() => document.querySelector("#audio-status").dataset.state === "ready");
    await page.evaluate(() => {
      webpackChunkbabylon_learning.push([[989995], {}, r => self.req = r]);
      for (const [id, f] of Object.entries(req.m)) if (/get LastCreatedEngine/.test(f.toString()))
        for (const v of Object.values(req(id))) if (typeof v === "function" && v.LastCreatedEngine?.scenes?.length) {
          self.s = v.LastCreatedScene; v.LastCreatedEngine.stopRenderLoop(); v.LastCreatedEngine.getDeltaTime = () => 50;
        }
    });
    await page.locator('[data-view="first-person"]').click();
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const camera = s.activeCamera;
      // Freeze the inspection camera; the real walking/collision path is covered elsewhere.
      camera.checkCollisions = false; camera.onAfterCheckInputsObservable.clear();
      document.querySelectorAll("body *").forEach(element => {
        if (element.tagName !== "CANVAS" && !element.contains(document.querySelector("canvas"))) element.style.display = "none";
      });
    });

    const normalPoses = [
      ["normal-master-front", [2.4, 1.2, 1.55], [2.4, 0, 1.65]],
      ["normal-study-front", [6.9, 1.4, 1.55], [6.9, 0, 1.65]],
      ["normal-kitchen-front", [9.6, 1.4, 1.55], [9.6, 0, 1.7]],
      ["normal-ensuite-front", [1.2, 6.0, 1.55], [0, 6, 1.9]],
      ["normal-living-front", [9.7, 8.4, 1.55], [10.8, 8.4, 1.65]],
      ["normal-bedroom-front", [3.9, 9.4, 1.55], [3.9, 10.8, 1.65]],
      ["normal-bedroom-left", [4.6, 9.4, 1.5], [2.9, 10.8, 1.4]],
      ["normal-bedroom-top", [3.9, 9.4, 1.62], [3.9, 10.8, 2.4]],
    ];
    for (const [name, position, target] of normalPoses) {
      await pose(position, target);
      await shot(name);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    await pose([3.9, 9.4, 1.55], [3.9, 10.8, 1.65]); await shot("normal-bedroom-portrait");
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(100);
    await pose([3.9, 9.4, 1.55], [3.9, 10.8, 1.65]); await shot("normal-bedroom-landscape");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(100);

    await page.evaluate(() => {
      const colors = { "warm-painted-wall": "#22ff44", "darkWood": "#ff2222", "wood": "#ffaa22",
        "window-glass": "#2222ff", "brass": "#ffff22" };
      s.materials.forEach(material => {
        const hex = colors[material.name]; if (!hex) return;
        material.albedoTexture = null; material.emissiveTexture = null;
        if ("unlit" in material) material.unlit = true;
        const Color = material.albedoColor ? material.albedoColor.constructor : material.emissiveColor.constructor;
        const color = Color.FromHexString(hex);
        material.albedoColor = color; material.emissiveColor = color;
      });
      s.meshes.forEach(mesh => { if (mesh.metadata?.exterior) mesh.setEnabled(false); });
      s.clearColor.set(0, 0, 0, 1);
    });
    const debugPoses = [
      ["debug-bedroom-front", [3.9, 9.4, 1.55], [3.9, 20, 1.55]],
      ["debug-bedroom-left", [4.6, 9.4, 1.5], [2.9, 10.8, 1.4]],
      ["debug-bedroom-top", [3.9, 9.4, 1.62], [3.9, 10.8, 2.4]],
      ["debug-bedroom-graze", [3.6, 9.7, 1.5], [2.9, 10.8, 1.5]],
    ];
    for (const [name, position, target] of debugPoses) {
      await pose(position, target);
      await shot(name);
    }

    // Sweep across the guest-room window's left reveal. Before the fix the buried casing and
    // the wall cut share the same plane, so these probes alternate between wall and wood.
    const sweep = [];
    for (let frame = 0; frame < 21; frame++) {
      const cameraX = 4.55 - frame * 0.035, yawOffset = (frame - 10) * 0.0025;
      await pose([cameraX, 9.45, 1.5], [2.9, 10.8, 1.4], yawOffset);
      const pixels = await page.evaluate(() => {
        const camera = s.activeCamera, V = camera.position.constructor, M = camera.getWorldMatrix().constructor;
        const engine = s.getEngine(), gl = engine._gl;
        const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
        const samples = [];
        for (const z of [26.76, 26.80, 26.85, 26.90, 26.95, 27.00, 27.05, 27.10, 27.15, 27.20, 27.24]) {
          const projected = V.Project(new V(-12.5, 3, z), M.Identity(), s.getTransformMatrix(), viewport);
          const buffer = new Uint8Array(4);
          gl.readPixels(Math.round(projected.x), engine.getRenderHeight() - 1 - Math.round(projected.y),
            1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
          samples.push({ z, rgb: Array.from(buffer.slice(0, 3)) });
        }
        return samples;
      });
      for (const sample of pixels) {
        const [r, g, b] = sample.rgb;
        sample.kind = g > r + 50 && g > b + 30 ? "wall" : r > g + 50 && r > b + 30 ? "casing" : "other";
      }
      sweep.push({ frame, cameraX, yawOffset, samples: pixels });
    }
    const redCount = sweep.reduce((n, frame) => n + frame.samples.filter(sample => sample.kind === "casing").length, 0);
    const scene = await page.evaluate(() => ({
      meshes: s.meshes.length, vertices: s.getTotalVertices(), materials: s.materials.length,
      textures: s.textures.length, lights: s.lights.length, cameras: s.cameras.length,
      windows: s.meshes.filter(mesh => mesh.material?.name === "window-glass").length,
    }));
    const jsRequests = requests.filter(request => new URL(request.url).pathname.endsWith(".js"));
    const firstScreenJsBytes = jsRequests.reduce((n, request) => n + request.bytes, 0);
    assert.ok(firstScreenJsBytes <= 3 * 1048576, "first-screen JS stays inside the 3 MiB budget");
    assert.deepEqual(errors, []);
    assert.ok(requests.every(request => request.status < 400));
    if (expectFixed) assert.equal(redCount, 0, "no casing pixels may appear on the reveal planes");
    fs.writeFileSync(path.join(output, "metrics.json"), JSON.stringify({
      passed: true, url, browser: browser.version(), expectFixed, redCount, firstScreenJsBytes,
      jsRequests: jsRequests.length, scene, errors, warnings, requests, sweep, fpsOrLoadTimeSampling: false,
    }, null, 2) + "\n");
    console.log(`Window reveal check ${expectFixed ? "passed" : "captured"}: red casing pixels ${redCount}, first-screen JS ${firstScreenJsBytes}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
