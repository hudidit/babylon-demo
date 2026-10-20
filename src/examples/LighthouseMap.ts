import { LIGHTHOUSE, LIGHTHOUSE_FLOORS } from "./LighthouseLayout";

const drawingY = (height: number) => 300 - (height - LIGHTHOUSE.floor) * 14;
export function lighthouseMapState(feet?: number) {
  const valid = feet !== undefined && Number.isFinite(feet) && feet >= LIGHTHOUSE.floor-.18 && feet <= LIGHTHOUSE.gallery+.8;
  return { visible: valid, y: valid ? drawingY(feet!) : 0,
    floor: valid ? LIGHTHOUSE_FLOORS.find(f=>Math.abs(f.height-feet!)<.18)?.index : undefined };
}
/** Shared storey heights, with no floor selector or teleport behavior. */
export function lighthouseLevelsSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 330" role="img" aria-label="灯塔两层剖面，标出楼面相对住宅高度及当前所在楼层">
    <path d="M36 306V65L54 48H102L120 65V306" fill="#ede7d8" stroke="#737e6a" stroke-width="2"/>
    <path d="M63 300V70M75 300V70" stroke="#8f784d" stroke-width="3"/>
    ${Array.from({length:28},(_,i)=>`<path d="M63 ${77+i*8}H75" stroke="#8f784d" stroke-width="2"/>`).join("")}
    ${LIGHTHOUSE_FLOORS.map(f=>`<g data-lighthouse-floor="${f.index}"><rect class="lighthouse-floor-highlight" x="128" y="${drawingY(f.height)-23}" width="228" height="39" rx="5" fill="#d7e5ce" visibility="hidden"/>
      <path d="M36 ${drawingY(f.height)}H120" stroke="#66745b" stroke-width="3"/>
      <text x="139" y="${drawingY(f.height)-6}" font-size="14" fill="#344a3c">${f.index+1}F · ${f.label}${f.index===1?" / 外廊":""}</text>
      <text x="139" y="${drawingY(f.height)+11}" font-size="12" fill="#67725e">+${f.height.toFixed(2)} m · ${f.index===0?"配电 / 工作灯 / 维护记录":f.index===1?"日间待机灯具 · 东南出口":"窗口观景 · 到层可离梯"}</text></g>`).join("")}
    <g id="lighthouse-height-marker" visibility="hidden"><path d="M82 0L94-7V7Z" fill="#bb6d3c"/><circle cx="69" r="5" fill="#bb6d3c" stroke="#fff5df" stroke-width="2"/></g>
    <text x="20" y="325" font-size="11" fill="#66745b">层高来自实际楼面 · 仅显示位置 · E 到层离梯</text></svg>`;
}
