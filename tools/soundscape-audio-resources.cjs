const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const hash = b => createHash('sha256').update(b).digest('hex');
function validateSoundscapeAudio(root) {
  const source = JSON.parse(fs.readFileSync(path.join(root,'audio/soundscape/source.json')));
  assert.equal(source.schemaVersion,1); assert.match(source.generatorSha256,/^[a-f0-9]{64}$/);
  const expected = ['motor-loop','roll-loop',...['wind','rain','sea'].flatMap(id => [id+'-open',id+'-sheltered']),
    ...['scooter-mount','scooter-brake'].flatMap(id => [id+'-1',id+'-2'])].sort();
  assert.deepEqual(source.files.map(r => r.id).sort(),expected,'Incomplete soundscape catalog');
  const sources = new Map(source.sources.map(s => [s.id,s])); assert.equal(sources.size,source.sources.length);
  for (const s of sources.values()) {
    assert.equal(s.license,s.id === 'procedural' ? 'ISC' : 'CC0-1.0','Unreviewed soundscape source license');
    assert.ok(s.page.startsWith('https://') && s.author && s.tier && s.verifiedOn,'Missing soundscape provenance');
    assert.match(s.sha256,/^[a-f0-9]{64}$/);
  }
  let encodedBytes = 0, decodedBytes = 0, coreBytes = 0;
  for (const row of source.files) {
    const loop = !row.id.startsWith('scooter-'); assert.equal(row.loop,loop);
    assert.match(row.file,/^audio\/soundscape\/[a-z0-9-]+\.[a-f0-9]{10}\.(wav|m4a)$/,'Unsafe soundscape path');
    assert.ok(row.sourceIds.length && new Set(row.sourceIds).size === row.sourceIds.length);
    assert.deepEqual(row.sourceSha256s,row.sourceIds.map(id => sources.get(id)?.sha256),'Unreviewed soundscape source');
    assert.equal(row.license,row.sourceIds.includes('procedural') ? 'ISC' : 'CC0-1.0');
    const data = fs.readFileSync(path.join(root,row.file)); assert.equal(data.length,row.bytes);
    assert.equal(hash(data),row.sha256,'Soundscape SHA256 mismatch');
    assert.ok(row.file.includes('.'+row.sha256.slice(0,10)+'.'));
    assert.equal(row.sampleRate,48000); assert.ok([1,2].includes(row.channels)); assert.equal(row.bitDepth,16);
    assert.ok(Number.isInteger(row.frames) && row.frames > 0);
    assert.equal(row.durationSeconds,row.frames/48000); assert.equal(row.decodedBytes,row.frames*row.channels*4);
    assert.ok(row.peak>.05 && row.peak<.71); assert.match(row.referencePcmSha256,/^[a-f0-9]{64}$/);
    if (loop) {
      assert.equal(row.format,'m4a'); assert.ok(row.file.endsWith('.m4a'));
      assert.equal(data.toString('ascii',4,8),'ftyp','Invalid AAC container');
      const entry = data.indexOf(Buffer.from('mp4a')); assert.ok(entry>0,'Missing AAC audio track');
      assert.equal(data.readUInt32BE(entry+28)/65536,row.sampleRate,'AAC rate mismatch');
      // AudioToolbox's legacy mp4a header says 2 even for mono; AAC AudioSpecificConfig is authoritative.
      const descriptor = at => { const tag=data[at++]; let size=0, byte;
        do { byte=data[at++]; size=(size<<7)|(byte&127); } while(byte&128);
        assert.ok(at+size<=data.length); return {tag,at,size}; };
      const esds=data.indexOf(Buffer.from('esds')); assert.ok(esds>0);
      const es=descriptor(esds+8); assert.equal(es.tag,3); assert.equal(data[es.at+2],0);
      const decoder=descriptor(es.at+3); assert.equal(decoder.tag,4); assert.equal(data[decoder.at],0x40);
      const config=descriptor(decoder.at+13); assert.equal(config.tag,5); assert.equal(config.size,2);
      const asc=data.readUInt16BE(config.at); assert.equal(asc>>11,2,'AAC LC required');
      assert.equal((asc>>7)&15,3,'AAC 48kHz required');
      assert.equal((asc>>3)&15,row.channels,'AAC channel mismatch');
      assert.ok(row.durationSeconds>=2 && row.durationSeconds<=8);
      assert.ok(row.boundaryStep<.004,'Discontinuous reference loop');
      assert.ok(row.processing.crossfadeSeconds>0);
    } else {
      assert.equal(row.format,'wav'); assert.ok(row.durationSeconds<=.2);
      assert.equal(data.toString('ascii',0,4),'RIFF'); assert.equal(data.toString('ascii',8,12),'WAVE');
      assert.equal(data.readUInt16LE(20),1); assert.equal(data.readUInt16LE(22),1);
      assert.equal(data.readUInt32LE(24),48000); assert.equal(data.readUInt16LE(34),16);
      assert.equal(data.length,44+row.frames*2);
      if (row.id.endsWith('-1')) coreBytes+=data.length;
    }
    encodedBytes+=data.length; decodedBytes+=row.decodedBytes;
  }
  assert.equal(encodedBytes,source.totalBytes); assert.equal(decodedBytes,source.decodedBytes);
  assert.ok(encodedBytes<=1.1*1048576,'Phase C audio allowance exceeded');
  return {files:source.files.map(r=>r.file),encodedBytes,decodedBytes,coreBytes};
}
module.exports = {validateSoundscapeAudio};
