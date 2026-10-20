import type { PowerCommand, LighthousePowerSnapshot } from "./LighthousePower";
import type { LighthousePanelLocation } from "./LighthousePanel";
import type { LighthouseOperationSnapshot } from "./LighthouseOperation";
import type { LighthouseMaintenanceSnapshot, LighthouseTool } from "./LighthouseMaintenance";
import { lighthouseEquipmentReading, lighthouseEquipmentDefinition } from "./LighthouseEquipmentLayout";
import { lighthouseClockLabel } from "./LighthousePanel";

const labels: Partial<Record<PowerCommand,string>> = {"start-generator":"启动机组 · 返回场景3秒", "stop-generator":"停止机组",
  refuel:"停机补给4单位 · 返回场景3秒", "verify-main":"检测主供电 · 返回场景2秒", "probe-generator":"验证机组实际回充 · 返回场景5秒"};
export class LighthousePowerPanel {
  private events=new AbortController();private buttons:HTMLButtonElement[]=[];
  constructor(private document:Document, command:(id:PowerCommand,tool:LighthouseTool)=>void) {
    const parent=document.querySelector('#lighthouse-power-actions')!;
    for(const id of Object.keys(labels) as PowerCommand[]) {
      const button=document.createElement('button');button.className='lighthouse-action';button.dataset.powerCommand=id;button.textContent=labels[id];
      button.addEventListener('click',()=>command(id,document.querySelector<HTMLSelectElement>('#lighthouse-tool')!.value as LighthouseTool),{signal:this.events.signal});
      parent.append(button);this.buttons.push(button);
    }
  }
  render(location:LighthousePanelLocation|undefined,op:LighthouseOperationSnapshot,m:LighthouseMaintenanceSnapshot,p:LighthousePowerSnapshot,automatic:boolean) {
    if(!location)return;
    const set=(id:string,text:string)=>{this.document.querySelector('#'+id)!.textContent=text;};
    if(lighthouseEquipmentDefinition(location)){const r=lighthouseEquipmentReading(location,op,m,p);set('lighthouse-panel-state',r.state);set('lighthouse-equipment-status',r.detail);}
    set('lighthouse-power-main',`${p.mainWh.toFixed(2)} / 2880Wh · ${(p.mainFraction*100).toFixed(1)}% · 净${p.mainNetW.toFixed(1)}W`);
    set('lighthouse-power-backup',`${p.backupWh.toFixed(2)} / 120Wh · ${(p.backupFraction*100).toFixed(1)}% · 净${p.backupNetW.toFixed(1)}W`);
    set('lighthouse-power-input',`太阳能 ${p.solarW.toFixed(1)}W；机组 ${p.generatorW}W（主${p.generatorMainW}/备用${p.generatorBackupW}W）`);
    set('lighthouse-power-status',`${automatic?'能量随自动场景时间推进':'能量暂停；开启自动流转才充放电/耗燃料'}。${p.protected?p.recoveryReady?'已回升20%，保持保护，需电池柜检测':'主灯低电保护，先补能':p.warning?'主电池25%低电预警':'主供电可用'}；机组${p.generatorRunning?'运行':'停止'}。${p.backupAvailable?'':'备用电源不可用，需独立补能。'}`);
    set('lighthouse-power-fuel',`${p.fuel.toFixed(2)} / 12燃料单位 · 估计${p.remainingHours.toFixed(2)}场景小时 · 储备${p.reserveFuel.toFixed(1)}单位（游戏参数）`);
    set('lighthouse-power-notice',p.notice||'启动和有效充电分别复验；满电限充或净能量未增加时不记回充通过。手动选时不补算能量。');
    this.buttons.forEach(button=>{button.hidden=button.dataset.powerCommand==='verify-main'?location!=='lighthouse-battery-main':location!=='lighthouse-generator';});
    const journal=this.document.querySelector('#lighthouse-power-events')!;
    journal.replaceChildren(...p.events.slice(-12).reverse().map(event=>{const li=this.document.createElement('li');li.textContent=`第${event.day}日 ${lighthouseClockLabel(event.hour)} · ${event.result}`;return li;}));
  }
  renderActivity(p:LighthousePowerSnapshot,viewing:boolean) {
    if(viewing||!p.action)return;
    const el=this.document.querySelector<HTMLElement>('#lighthouse-activity')!;el.hidden=false;
    el.textContent=`${labels[p.action.command]||'太阳能实际回充采样'} · ${p.action.elapsed.toFixed(1)} / ${p.action.duration}活跃秒；保持看向设备。`;
  }
  dispose(){this.events.abort();this.buttons.forEach(b=>b.remove());this.buttons=[];}
}
