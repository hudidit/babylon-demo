// Capture the existing RoomScene instance through a debugger pause in its speed setter.
// The served production bundle is never replaced, modified or rebuilt for this harness.
exports.captureRoom=async(page,cdp)=>{
 const scripts=[];cdp.on('Debugger.scriptParsed',s=>scripts.push(s));await cdp.send('Debugger.enable');
 let breakpoint;
 for(const script of scripts.filter(s=>s.url.startsWith('http'))){
  const {scriptSource:source}=await cdp.send('Debugger.getScriptSource',{scriptId:script.scriptId});
  const match=/setMovementSpeed\([^)]*\)\s*\{/.exec(source);if(!match)continue;
  const offset=match.index+match[0].length,lines=source.slice(0,offset).split('\n');
  breakpoint=await cdp.send('Debugger.setBreakpoint',{location:{scriptId:script.scriptId,lineNumber:lines.length-1,columnNumber:lines.at(-1).length}});break;
 }
 if(!breakpoint)throw new Error('RoomScene speed setter not found in production scripts');
 const captured=new Promise((resolve,reject)=>{cdp.once('Debugger.paused',async event=>{try{
  const result=await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:event.callFrames[0].callFrameId,expression:'self.room=this;self.s=this.scene;self.e=this.engine;!!self.s',returnByValue:true});
  if(!result.result.value)throw new Error('Paused frame is not a RoomScene');await cdp.send('Debugger.resume');resolve();
 }catch(error){await cdp.send('Debugger.resume');reject(error);}});});
 await page.locator('#movement-speed').evaluate(n=>{n.value='1';n.dispatchEvent(new Event('input',{bubbles:true}));});await captured;
 await cdp.send('Debugger.removeBreakpoint',{breakpointId:breakpoint.breakpointId});await cdp.send('Debugger.disable');
};
