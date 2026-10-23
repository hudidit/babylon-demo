const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const dist=path.resolve(__dirname,'../../../../dist'),fixture='/private/tmp/simple-lamp-fixture',log=path.join(__dirname,'network.jsonl');
// Append requests across server restarts; clear explicitly before a new measurement.

function serve(directory,port,record=false){http.createServer((req,res)=>{
  let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/home\//,'/');if(name.endsWith('/'))name+='index.html';
  const root=directory===fixture&&!name.startsWith('/js/')&&name!='/index.html'&&name!='/viewport.html'?dist:directory,file=path.resolve(root,'.'+name);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Cache-Control':'no-store','Content-Length':data.length,'Content-Type':({'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'});
    if(record&&req.headers['sec-fetch-dest']==='script')fs.appendFileSync(log,JSON.stringify({url:req.url,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')})+'\n');res.end(data);
  });
}).listen(port,'127.0.0.1',()=>console.log(`${directory===dist?'Final dist':'Pose fixture'}: http://127.0.0.1:${port}/`));}
serve(dist,8770,true);serve(fixture,8771);
