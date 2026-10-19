/** Read the existing engine in Chrome/WebKit; application classes may be private after scope hoisting. */
exports.capture=page=>page.evaluate(()=>{
  webpackChunkbabylon_learning.push([[987644],{},r=>self.deliveryRequire=r]);
  for(const [id,factory]of Object.entries(deliveryRequire.m)){
    if(!/get LastCreatedEngine/.test(factory.toString()))continue;
    for(const value of Object.values(deliveryRequire(id)))if(typeof value==='function'&&value.LastCreatedEngine?.scenes?.length){self.s=value.LastCreatedScene;self.e=value.LastCreatedEngine;}
  }
  if(!self.s)throw new Error('Existing production engine not found');
  e.stopRenderLoop();e.getDeltaTime=()=>50;
});
