const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const hash=b=>createHash('sha256').update(b).digest('hex');
function validateBirdAudio(root){
  const source=JSON.parse(fs.readFileSync(path.join(root,'audio/birds/source.json')));
  assert.equal(source.schemaVersion,1);assert.match(source.generatorSha256,/^[a-f0-9]{64}$/);
  assert.deepEqual(source.files.map(r=>r.id).sort(),['bird-call-1','bird-call-2']);
  assert.equal(source.sources.length,1);const raw=source.sources[0];assert.equal(raw.license,'CC0-1.0','Unreviewed bird license');
  assert.ok(raw.author&&raw.page.startsWith('https://')&&raw.tier&&raw.pageLicenseEvidence&&raw.verifiedOn);assert.match(raw.sha256,/^[a-f0-9]{64}$/);
  let encodedBytes=0,decodedBytes=0;
  for(const row of source.files){
    assert.match(row.file,/^audio\/birds\/bird-call-[12]\.[a-f0-9]{10}\.wav$/,'Unsafe bird path');
    assert.equal(row.sourceId,raw.id);assert.equal(row.sourceSha256,raw.sha256);assert.equal(row.license,'CC0-1.0');assert.equal(row.loop,false,'Birds must not loop');
    const b=fs.readFileSync(path.join(root,row.file));assert.equal(b.length,row.bytes);assert.equal(hash(b),row.sha256,'Bird SHA256 mismatch');assert.ok(row.file.includes('.'+row.sha256.slice(0,10)+'.'));
    assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');assert.equal(b.toString('ascii',12,16),'fmt ');assert.equal(b.readUInt32LE(16),16);
    assert.equal(b.readUInt16LE(20),1);assert.equal(b.readUInt16LE(22),1);assert.equal(b.readUInt32LE(24),48000);assert.equal(b.readUInt16LE(34),16);assert.equal(b.toString('ascii',36,40),'data');
    assert.equal(b.length,44+row.frames*2);assert.equal(b.readUInt32LE(40),row.frames*2);assert.equal(row.sampleRate,48000);assert.equal(row.channels,1);assert.equal(row.bitDepth,16);
    assert.equal(row.durationSeconds,row.frames/48000);assert.ok(row.durationSeconds>0&&row.durationSeconds<=.7);assert.equal(row.decodedBytes,row.frames*4);
    let peak=0;for(let i=44;i<b.length;i+=2)peak=Math.max(peak,Math.abs(b.readInt16LE(i))/32768);assert.equal(peak,row.peak);assert.ok(peak>.05&&peak<.4);
    encodedBytes+=b.length;decodedBytes+=row.decodedBytes;
  }
  assert.equal(encodedBytes,source.totalBytes);assert.equal(decodedBytes,source.decodedBytes);assert.ok(decodedBytes<=.28*1048576,'Bird PCM allowance exceeded');
  return {files:source.files.map(r=>r.file),encodedBytes,decodedBytes,coreBytes:0};
}
module.exports={validateBirdAudio};
