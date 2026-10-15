const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { readGlb, integrity, hash } = require('../tools/optimize-study-models.cjs');
const root = path.resolve(__dirname, '..');
const manifest = require('../public/models/study-model-optimization.json');

function jpegDimensions(buffer) {
  assert.equal(buffer.readUInt16BE(0), 0xffd8);
  for (let offset = 2; offset < buffer.length;) {
    assert.equal(buffer[offset++], 255);
    while (buffer[offset] === 255) offset++;
    const marker = buffer[offset++];
    if ([0xd8, 0xd9, 1].includes(marker)) continue;
    const length = buffer.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return [buffer.readUInt16BE(offset + 5), buffer.readUInt16BE(offset + 3)];
    assert.notEqual(marker, 0xda, 'JPEG must declare dimensions before scan data');
    offset += length;
  }
  throw new Error('Missing JPEG dimensions');
}

for (const model of manifest.models) test(`${path.basename(model.file)} retains original geometry, UVs and material graph after image optimization`, () => {
  const source = fs.readFileSync(path.join(root, model.file));
  assert.equal(hash(source), model.delivery.sha256, 'delivery hash must match the processing record');
  assert.equal(source.length, model.delivery.bytes);
  const { document, binary } = readGlb(source);
  assert.deepEqual(integrity(document, binary), model.original.integrity,
    'fixed source fingerprints protect every non-image byte and all nodes, accessors, materials and samplers');
  assert.equal(document.images.length, 3);
  for (const image of model.delivery.images) {
    const view = document.bufferViews[document.images[image.index].bufferView];
    assert.equal(view.byteOffset % 4, 0);
    const payload = binary.subarray(view.byteOffset, view.byteOffset + view.byteLength);
    assert.equal(hash(payload), image.sha256);
    assert.deepEqual(jpegDimensions(payload), image.dimensions);
    assert.deepEqual(image.dimensions, image.kind === 'color' ? [2048, 2048] : [1024, 1024]);
    assert.equal(document.images[image.index].mimeType, 'image/jpeg');
  }
});

test('optimized study models stay inside the documented image-quality-adjusted budget', () => {
  assert.equal(manifest.models.length, 2);
  assert.equal(manifest.modelBudgetBytes, 4.25 * 1048576);
  const bytes = manifest.models.reduce((sum, model) => sum + fs.statSync(path.join(root, model.file)).size, 0);
  assert.ok(bytes <= manifest.modelBudgetBytes);
  assert.ok(bytes < manifest.models.reduce((sum, model) => sum + model.original.bytes, 0) * 0.12);
});
