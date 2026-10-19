// Availability checks do not enable browser automation settings or alter existing profiles.
const fs=require('node:fs'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process');
const pw=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const record={baseline:'69606ac',checkedOn:'2026-10-19',settingsChanged:false,physicalDevicesTested:false};
  try{
    const browser=await pw.firefox.launch({executablePath:process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE,headless:true,timeout:20000});
    record.firefox={available:true,version:browser.version()};await browser.close();
  }catch(error){record.firefox={available:false,tested:false,error:String(error)};}
  let driver,logs='';
  try{
    const version=execFileSync('/usr/bin/safaridriver',['--version'],{encoding:'utf8'}).trim();
    driver=spawn('/usr/bin/safaridriver',['--port','8197'],{stdio:['ignore','pipe','pipe']});
    driver.stdout.on('data',data=>{logs+=data;});driver.stderr.on('data',data=>{logs+=data;});
    let ready=false;
    for(let i=0;i<50;i++){try{const response=await fetch('http://127.0.0.1:8197/status');if(response.ok){ready=true;break;}}catch{}await delay(100);}
    if(!ready)throw new Error('Safari WebDriver did not become ready: '+logs);
    const response=await fetch('http://127.0.0.1:8197/session',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({capabilities:{alwaysMatch:{browserName:'safari'}}}),signal:AbortSignal.timeout(20000)});
    const body=await response.json(),id=body.value?.sessionId;
    record.safari={version,available:response.ok&&!!id,status:response.status,body};
    if(id)await fetch('http://127.0.0.1:8197/session/'+id,{method:'DELETE'});
  }catch(error){record.safari={available:false,tested:false,error:String(error)};}finally{driver?.kill('SIGTERM');}
  record.safari.driverLogs=logs;
  record.physicalDevices={tested:false,reason:'No physical-device automation session was supplied for this task; simulated viewports are recorded separately.'};
  fs.writeFileSync(path.join(__dirname,'platform-availability.json'),JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify(record));
})().catch(error=>{console.error(error);process.exitCode=1;});
