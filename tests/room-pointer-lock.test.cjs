const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/examples/RoomPointerLock.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = { exports: {} };
new Function('module', 'exports', compiled)(loaded, loaded.exports);
const { RoomPointerLock } = loaded.exports;

test('pointer lock handles browser Escape, explicit release, rejection, late success and disposal', async () => {
  const original = global.document;
  const listeners = new Map();
  const emit = type => listeners.get(type)?.();
  const document = global.document = {
    pointerLockElement: null,
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type, handler) => { if (listeners.get(type) === handler) listeners.delete(type); },
    exitPointerLock() { this.pointerLockElement = null; emit('pointerlockchange'); },
  };
  let requests = 0, exits = 0, failures = 0;
  const changed = [];
  const canvas = { requestPointerLock() { requests++; } }; // Legacy void-returning implementation.
  const lock = new RoomPointerLock(canvas, value => changed.push(value), () => exits++, () => failures++);
  try {
    lock.request(); lock.request(); assert.equal(requests, 1, 'do not issue duplicate pending requests');
    document.pointerLockElement = canvas; emit('pointerlockchange'); assert.equal(changed.at(-1), true);
    document.pointerLockElement = null; emit('pointerlockchange'); assert.equal(exits, 1, 'browser Escape must exit without keydown');
    lock.request(); document.pointerLockElement = canvas; emit('pointerlockchange');
    lock.release(); assert.equal(exits, 1, 'releasing for settings must not trigger browser-exit callback');
    lock.request(); lock.release(); document.pointerLockElement = canvas; emit('pointerlockchange');
    assert.equal(document.pointerLockElement, null, 'a canceled pending request must not recapture the pointer');
    canvas.requestPointerLock = () => Promise.reject(new Error('blocked'));
    lock.request(); await Promise.resolve(); assert.equal(failures, 1);
    canvas.requestPointerLock = () => { throw new Error('not supported'); };
    lock.request(); assert.equal(failures, 2);
    canvas.requestPointerLock = undefined;
    lock.request(); assert.equal(failures, 3);
    canvas.requestPointerLock = () => {};
    lock.request(); emit('pointerlockerror'); assert.equal(failures, 4);
    lock.dispose(); assert.equal(listeners.size, 0);
    lock.request(); assert.equal(document.pointerLockElement, null);
  } finally {
    if (original === undefined) delete global.document;
    else global.document = original;
  }
});
