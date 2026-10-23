const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../../dist');
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
const walk=(dir)=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
(async()=>{
 const results=[];
 for(const prefix of ['', 'home/']) {
  const files=walk(root),failures=[];
  for(let i=0;i<files.length;i+=8)await Promise.all(files.slice(i,i+8).map(async file=>{
   const name=path.relative(root,file),local=fs.readFileSync(file),response=await fetch(`http://127.0.0.1:8770/${prefix}${name}`),body=Buffer.from(await response.arrayBuffer());
   if(!response.ok||body.length!==local.length||digest(body)!==digest(local))failures.push(name);
  }));
  results.push({path:'/'+prefix,files:files.length,failures});
 }
 fs.writeFileSync(path.join(__dirname,'hosted-check.json'),JSON.stringify(results,null,2)+'\n');
 if(results.some(r=>r.failures.length))throw Error('Hosted content mismatch');console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exitCode=1;});
