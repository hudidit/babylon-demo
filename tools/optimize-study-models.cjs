// Offline, image-only optimization for the two existing study GLBs.
// Does not install dependencies, modify the source files, or touch application code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const sourceCommit = 'fd32f40f25f25cea679df2d30d85aaeb5a4c8a70';
const inputs = [
  { file: 'public/models/gothic_commode.glb', sha256: '02c6498b5d17c79ed915a986564ce5ccd2255ae6daf920d24a3a7d8c140ae1fc', introducedBy: '9a2d8c1dbcf55b37b91abf24320660e50db8afb5' },
  { file: 'public/models/wooden_bookshelf.glb', sha256: 'a5da5338af3d629c13ae98b83d7c38c3347b23ebe7505eab0ffc22b2476200cb', introducedBy: '0e83f4c8e23912760fbc313e7d4d62169d16c30d' },
];
const profiles = {
  '1k-c85': { color: [1024, 85], data: [1024, 95], normal: [1024, 95] },
  '1k-c90': { color: [1024, 90], data: [1024, 97], normal: [1024, 97] },
  '1k-c95': { color: [1024, 95], data: [1024, 98], normal: [1024, 98] },
  'mixed-c90': { color: [2048, 90], data: [1024, 97], normal: [2048, 97] },
  'mixed-c95': { color: [2048, 95], data: [1024, 98], normal: [2048, 98] },
  'detail-c85': { color: [2048, 85], data: [1024, 90], normal: [1024, 95] },
  'detail-c90': { color: [2048, 90], data: [1024, 90], normal: [1024, 95] },
};
const hash = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

function readGlb(buffer) {
  assert.equal(buffer.readUInt32LE(0), 0x46546c67);
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  const chunks = [];
  for (let offset = 12; offset < buffer.length;) {
    const length = buffer.readUInt32LE(offset);
    assert.equal(length % 4, 0);
    chunks.push({ type: buffer.readUInt32LE(offset + 4), data: buffer.subarray(offset + 8, offset + 8 + length) });
    offset += 8 + length;
    assert.ok(offset <= buffer.length);
  }
  assert.deepEqual(chunks.map(chunk => chunk.type), [0x4e4f534a, 0x004e4942]);
  const document = JSON.parse(chunks[0].data.toString());
  assert.equal(document.buffers.length, 1);
  assert.ok(!document.buffers[0].uri);
  assert.deepEqual(document.extensionsUsed || [], []);
  return { document, binary: chunks[1].data };
}

function integrity(document, binary) {
  const normalized = structuredClone(document);
  const imageViews = new Set(document.images.map(image => image.bufferView));
  delete normalized.buffers[0].byteLength;
  const geometryViews = [];
  normalized.bufferViews.forEach((view, index) => {
    delete view.byteOffset;
    if (imageViews.has(index)) delete view.byteLength;
    else {
      const original = document.bufferViews[index];
      const offset = original.byteOffset || 0;
      geometryViews.push({ index, bytes: original.byteLength,
        sha256: hash(binary.subarray(offset, offset + original.byteLength)) });
    }
  });
  return { semanticSha256: hash(Buffer.from(canonical(normalized))), geometryViews };
}

function repack(document, binary, replacements) {
  const output = structuredClone(document);
  let offset = 0;
  const parts = [];
  output.bufferViews.forEach((view, index) => {
    assert.equal(view.buffer, 0);
    const source = document.bufferViews[index];
    const data = replacements.get(index) || binary.subarray(source.byteOffset || 0, (source.byteOffset || 0) + source.byteLength);
    view.byteOffset = offset;
    view.byteLength = data.length;
    parts.push(data);
    const padding = (4 - data.length % 4) % 4;
    parts.push(Buffer.alloc(padding));
    offset += data.length + padding;
  });
  output.buffers[0].byteLength = offset;
  const bin = Buffer.concat(parts);
  const json = Buffer.from(JSON.stringify(output));
  const jsonPadded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + bin.length, 8);
  const chunkHeader = (length, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(length); h.writeUInt32LE(type, 4); return h; };
  const result = Buffer.concat([header, chunkHeader(jsonPadded.length, 0x4e4f534a), jsonPadded,
    chunkHeader(bin.length, 0x004e4942), bin]);
  assert.deepEqual(integrity(output, bin), integrity(document, binary), 'Geometry, UV, nodes and material graph must stay identical');
  return result;
}

function imageKind(document, index) {
  const material = document.materials[0];
  const slots = [
    ['color', material.pbrMetallicRoughness.baseColorTexture],
    ['data', material.pbrMetallicRoughness.metallicRoughnessTexture],
    ['normal', material.normalTexture],
  ];
  const kinds = slots.filter(([, slot]) => document.textures[slot.index].source === index).map(([kind]) => kind);
  assert.equal(kinds.length, 1);
  return kinds[0];
}

async function encode(sharp, source, kind, [edge, quality]) {
  const metadata = await sharp(source).metadata();
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.channels, 3);
  const { data, info } = await sharp(source).resize(edge, edge, {
    fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3',
  }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 3);
  // No gamma transform is applied to normal or metallic/roughness channel data.
  if (kind === 'normal') {
    for (let i = 0; i < data.length; i += 3) {
      const x = data[i] / 127.5 - 1, y = data[i + 1] / 127.5 - 1, z = data[i + 2] / 127.5 - 1;
      const length = Math.hypot(x, y, z);
      if (length < 1e-8) { data[i] = 128; data[i + 1] = 128; data[i + 2] = 255; }
      else {
        data[i] = Math.round((x / length + 1) * 127.5);
        data[i + 1] = Math.round((y / length + 1) * 127.5);
        data[i + 2] = Math.round((z / length + 1) * 127.5);
      }
    }
  }
  const jpegOptions = { quality, chromaSubsampling: '4:4:4', progressive: false, mozjpeg: false };
  const encoded = await sharp(data, { raw: info }).jpeg(jpegOptions).toBuffer();
  const decoded = await sharp(encoded).raw().toBuffer();
  let squaredError = 0, angularSum = 0;
  const channelError = [0, 0, 0];
  for (let i = 0; i < data.length; i++) {
    const difference = decoded[i] - data[i];
    squaredError += difference * difference;
    channelError[i % 3] += Math.abs(difference);
  }
  if (kind === 'normal') for (let i = 0; i < data.length; i += 3) {
    const a = [data[i], data[i + 1], data[i + 2]].map(value => value / 127.5 - 1);
    const b = [decoded[i], decoded[i + 1], decoded[i + 2]].map(value => value / 127.5 - 1);
    const cosine = a.reduce((sum, value, j) => sum + value * b[j], 0) / (Math.hypot(...a) * Math.hypot(...b));
    angularSum += Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
  }
  return { encoded, record: {
    kind, inputDimensions: [metadata.width, metadata.height], dimensions: [info.width, info.height],
    kernel: 'lanczos3', normalRenormalized: kind === 'normal', gammaTransform: false, jpegOptions,
    inputBytes: source.length, inputSha256: hash(source), bytes: encoded.length, sha256: hash(encoded),
    codecMetricsReference: 'resized raw pixels before JPEG encoding; excludes resolution loss',
    psnrDb: 10 * Math.log10(255 * 255 / (squaredError / data.length)),
    channelMeanAbsoluteError: channelError.map(value => value / (data.length / 3)),
    normalMeanAngularErrorDegrees: kind === 'normal' ? angularSum / (data.length / 3) : null,
  } };
}

async function main() {
  const outputArg = process.argv.indexOf('--output');
  if (outputArg < 0 || !process.argv[outputArg + 1]) throw new Error('Usage: node tools/optimize-study-models.cjs --output <temporary-directory>');
  const output = path.resolve(process.argv[outputArg + 1]);
  assert.ok(output !== path.join(root, 'public') && !output.startsWith(path.join(root, 'public') + path.sep));
  const profilesArg = process.argv.indexOf('--profiles');
  const generatedProfiles = profilesArg >= 0 ? process.argv[profilesArg + 1].split(',') : Object.keys(profiles);
  assert.ok(generatedProfiles.length && generatedProfiles.every(name => Object.hasOwn(profiles, name)), 'Unknown profile');
  const sharp = require(process.env.SHARP_PACKAGE || 'sharp');
  sharp.concurrency(2);
  const report = { sourceCommit, tool: 'tools/optimize-study-models.cjs', node: process.version,
    imageLibraries: sharp.versions, policy: 'Only JPEG payloads, buffer offsets/lengths and GLB padding change.',
    profiles, generatedProfiles, models: [] };
  for (const input of inputs) {
    const source = execFileSync('git', ['show', `${sourceCommit}:${input.file}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
    assert.equal(hash(source), input.sha256);
    fs.mkdirSync(path.join(output, 'originals'), { recursive: true });
    fs.writeFileSync(path.join(output, 'originals', path.basename(input.file)), source);
    const { document, binary } = readGlb(source);
    assert.equal(document.images.length, 3);
    assert.equal(document.materials.length, 1);
    const model = { file: input.file, sourceBytes: source.length, sourceSha256: input.sha256,
      introducedBy: input.introducedBy, provenance: { upstreamUrl: null, license: 'unverified',
        note: 'Existing repository asset; introduction commits contain no upstream or license record. Not part of the Poly Haven CC0 manifest.' },
      sourceIntegrity: integrity(document, binary), candidates: [] };
    for (const [profile, settings] of Object.entries(profiles)) {
      if (!generatedProfiles.includes(profile)) continue;
      const replacements = new Map();
      const images = [];
      for (let index = 0; index < document.images.length; index++) {
        const image = document.images[index], view = document.bufferViews[image.bufferView];
        assert.equal(image.mimeType, 'image/jpeg');
        const payload = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
        const kind = imageKind(document, index);
        const { encoded, record } = await encode(sharp, payload, kind, settings[kind]);
        replacements.set(image.bufferView, encoded);
        images.push({ index, name: image.name, bufferView: image.bufferView, ...record });
      }
      const result = repack(document, binary, replacements);
      const directory = path.join(output, profile);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, path.basename(input.file)), result);
      const decodedResult = readGlb(result);
      model.candidates.push({ profile, bytes: result.length, sha256: hash(result), images,
        outputIntegrity: integrity(decodedResult.document, decodedResult.binary) });
      console.log(JSON.stringify({ model: path.basename(input.file), profile, bytes: result.length }));
    }
    report.models.push(model);
  }
  fs.writeFileSync(path.join(output, 'candidates.json'), JSON.stringify(report, null, 2) + '\n');
}

module.exports = { readGlb, integrity, repack, inputs, profiles, hash };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
