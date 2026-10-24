const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {validateAac}=require('./soundscape-audio-resources.cjs');
const hash=data=>createHash('sha256').update(data).digest('hex');
function validateDailyAudio(root){
  const source=JSON.parse(fs.readFileSync(path.join(root,'audio/daily/source.json')));
  assert.equal(source.schemaVersion,1);assert.match(source.generatorSha256,/^[a-f0-9]{64}$/);
  const materials=['wood','hard','earth','metal','soft'];
  const expected=[...materials.flatMap(m=>(m==='soft'?[1,2,3]:[1,2,3,4]).map(i=>'footstep-'+m+'-'+i)),
    ...materials.flatMap(m=>[1,2].map(i=>'landing-'+m+'-'+i)),...['ladder-rung-1','ladder-rung-2','ladder-rung-3',
    'curtain-move-1','curtain-move-2','beacon-drive','ui-contact-1','ui-contact-2']].sort();
  assert.deepEqual(source.files.map(r=>r.id).sort(),expected,'Incomplete daily audio catalog');
  const sources=new Map(source.sources.map(s=>[s.id,s]));assert.equal(sources.size,source.sources.length);
  for(const s of sources.values()){
    assert.equal(s.license,s.id==='ui-tone'?'ISC':'CC0-1.0','Unreviewed daily source license');
    assert.ok(s.page.startsWith('https://')&&s.author&&s.tier&&s.verifiedOn,'Missing daily provenance');
    assert.match(s.sha256,/^[a-f0-9]{64}$/);
  }
  assert.match(fs.readFileSync(path.join(root,'audio/daily/Kenney-License.txt'),'utf8'),/Creative Commons Zero, CC0/);
  let encodedBytes=0,decodedBytes=0,coreBytes=0;
  for(const row of source.files){
    const world=row.id==='beacon-drive',loop=world||row.id.startsWith('curtain-move-');
    assert.equal(row.loop,loop);assert.equal(row.preload,world?'world':row.id==='ui-contact-1'?'core':'variation');
    assert.match(row.file,/^audio\/daily\/[a-z0-9-]+\.[a-f0-9]{10}\.(wav|m4a)$/,'Unsafe daily audio path');
    assert.ok(row.sourceIds.length&&new Set(row.sourceIds).size===row.sourceIds.length);
    assert.deepEqual(row.sourceSha256s,row.sourceIds.map(id=>sources.get(id)?.sha256),'Unreviewed daily source');
    assert.equal(row.license,row.sourceIds.includes('ui-tone')?'ISC':'CC0-1.0');
    const data=fs.readFileSync(path.join(root,row.file));assert.equal(data.length,row.bytes);
    assert.equal(hash(data),row.sha256,'Daily audio SHA256 mismatch');assert.ok(row.file.includes('.'+row.sha256.slice(0,10)+'.'));
    assert.equal(row.sampleRate,48000);assert.equal(row.channels,1);assert.equal(row.bitDepth,16);
    assert.ok(Number.isInteger(row.frames)&&row.frames>0);assert.equal(row.durationSeconds,row.frames/48000);
    assert.equal(row.decodedBytes,row.frames*4);assert.match(row.referencePcmSha256,/^[a-f0-9]{64}$/);
    assert.ok(row.peak>.05&&row.peak<.71);
    if(world){assert.equal(row.format,'m4a');validateAac(data,row);assert.equal(row.durationSeconds,2);assert.ok(row.boundaryStep<.004);}
    else{
      assert.equal(row.format,'wav');assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WAVE');
      assert.equal(data.toString('ascii',12,16),'fmt ');assert.equal(data.readUInt32LE(16),16);
      assert.equal(data.readUInt16LE(20),1);assert.equal(data.readUInt16LE(22),1);assert.equal(data.readUInt32LE(24),48000);
      assert.equal(data.readUInt16LE(34),16);assert.equal(data.toString('ascii',36,40),'data');assert.equal(data.readUInt32LE(40),row.frames*2);
      assert.equal(data.length,44+row.frames*2);assert.equal(hash(data),row.referencePcmSha256);
      assert.ok(row.durationSeconds<=.5);
      let peak=0;for(let i=44;i<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i))/32768);
      assert.equal(peak,row.peak);assert.equal(Math.abs(data.readInt16LE(44)-data.readInt16LE(data.length-2))/32768,row.boundaryStep);
      if(loop)assert.ok(row.boundaryStep<.004,'Daily loop seam');
    }
    assert.equal(row.processing.crossfadeSeconds>0,loop);
    encodedBytes+=data.length;decodedBytes+=row.decodedBytes;if(row.preload==='core')coreBytes+=data.length;
  }
  for(const m of materials){const variants=source.files.filter(r=>r.cue==='footstep-'+m);assert.equal(new Set(variants.map(r=>r.sha256)).size,variants.length,'Duplicate footstep variation');}
  assert.equal(encodedBytes,source.totalBytes);assert.equal(decodedBytes,source.decodedBytes);
  assert.ok(encodedBytes<=.85*1048576,'Phase D encoded allowance exceeded');assert.ok(decodedBytes<=2*1048576,'Phase D PCM allowance exceeded');
  return {files:source.files.map(r=>r.file),encodedBytes,decodedBytes,coreBytes};
}
module.exports={validateDailyAudio};
