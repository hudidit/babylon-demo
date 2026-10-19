// Probe availability without changing browser security settings or using an existing profile.
const fs=require('node:fs'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process');
const pw=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
(async()=>{
  const record={baseline:'bea1db6',checkedOn:'2026-10-19',settingsChanged:false,physicalDevicesTested:false};
  try{const browser=await pw.firefox.launch({executablePath:process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE,headless:true,timeout:15000});
    record.firefox={available:true,version:browser.version(),cloudsStarsTested:false};await browser.close();
  }catch(error){record.firefox={available:false,cloudsStarsTested:false,error:String(error)};}
  let driver,logs='';
  try{
    record.safariVersion=execFileSync('/usr/bin/safaridriver',['--version'],{encoding:'utf8'}).trim();
    driver=spawn('/usr/bin/safaridriver',['--port','8198'],{stdio:['ignore','pipe','pipe']});
    driver.stdout.on('data',data=>{logs+=data;});driver.stderr.on('data',data=>{logs+=data;});
    let ready=false;
    for(let i=0;i<40;i++){try{const response=await fetch('http://127.0.0.1:8198/status');if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
    if(!ready)throw new Error('Safari WebDriver did not become ready');
    const response=await fetch('http://127.0.0.1:8198/session',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({capabilities:{alwaysMatch:{browserName:'safari'}}}),signal:AbortSignal.timeout(15000)});
    const body=await response.json(),id=body.value?.sessionId;
    record.safari={available:response.ok&&!!id,cloudsStarsTested:false,status:response.status,body};
    if(id)await fetch('http://127.0.0.1:8198/session/'+id,{method:'DELETE'});
  }catch(error){record.safari={available:false,cloudsStarsTested:false,error:String(error)};}finally{driver?.kill('SIGTERM');}
  record.safari.driverLogs=logs;fs.writeFileSync(path.join(__dirname,'platform-availability.json'),JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify(record));
})().catch(error=>{console.error(error);process.exitCode=1;});
