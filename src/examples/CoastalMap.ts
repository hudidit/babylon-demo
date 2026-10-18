import { coastalCrestY, COASTAL_CLIFF, coastalSurfaceHeight } from "./CoastalCliff";
import { coastalRoute, coastalRouteLength, COASTAL_SITE, COASTAL_WALK_BOUNDARY } from "./CoastalSite";

/** Same north-up left-handed projection as the house map and the actual overhead camera. */
export function coastalDrawingPoint(x: number, y: number) { return { x: 40 + (22 - x) * 3, y: 48 + (y + 16) * 3 }; }

export function coastalPlanSvg(compact = false) {
  const p = coastalDrawingPoint, point = (x: number, y: number) => { const v = p(x, y); return `${v.x.toFixed(2)},${v.y.toFixed(2)}`; };
  const a = COASTAL_CLIFF, site = COASTAL_SITE;
  const crest = Array.from({ length: a.columns + 1 }, (_, i) => {
    const x = a.eastX - (a.eastX - a.westX) * i / a.columns; return point(x, coastalCrestY(x));
  }).join(" ");
  const route = coastalRoute().filter((_, i) => i % 3 === 0), end = coastalRoute().slice(-1)[0]; route.push(end);
  const landmark = (x: number, y: number, label: string, dx: number, dy: number) => {
    const v = p(x, y); return `<g><circle cx="${v.x}" cy="${v.y}" r="6" fill="#fff7e6" stroke="#6b765f" stroke-width="2"/><text x="${v.x + dx}" y="${v.y + dy}" font-size="15" fill="#44523e">${label}</text></g>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${compact ? "20 30 560 370" : "0 0 620 490"}" role="img" aria-label="海岸路线图：可从房屋经崖顶步道和观景点步行到灯塔，虚线为护栏边界">
    <rect width="620" height="490" rx="12" fill="#c6d9da"/>
    <polygon points="${point(a.eastX, -40)} ${crest} ${point(a.westX, -40)}" fill="#dce1c9" stroke="#8b947b" stroke-width="3"/>
    <polygon points="${COASTAL_WALK_BOUNDARY.map(v => point(v.x, v.y)).join(" ")}" fill="none" stroke="#6d7864" stroke-width="1.3" stroke-dasharray="4 3"/>
    <polyline points="${route.map(v => point(v.x, v.y)).join(" ")}" fill="none" stroke="#a07849" stroke-width="5.4" stroke-linejoin="round" stroke-linecap="round"/>
    <polygon points="${[[0,0],[10.8,0],[10.8,12.3],[5.4,12.3],[5.4,10.8],[0,10.8]].map(v => point(v[0],v[1])).join(" ")}" fill="#faf4e7" stroke="#6d7864" stroke-width="2"/>
    ${landmark(5.4, 5.4, "房屋", -17, -30)}
    ${landmark(site.lookout.x, site.lookout.y, "观景点", -25, -14)}
    ${landmark(site.tower.x, site.tower.y, "灯塔", 12, 5)}
    <text x="315" y="252" font-size="14" fill="#746548">步道约${coastalRouteLength((x, y) => coastalSurfaceHeight(x, y)!).toFixed(0)}米</text>
    <text x="180" y="405" font-size="25" fill="#708f96" letter-spacing="8">大海</text>
    <g transform="translate(577 55)" fill="#57664e" stroke="#57664e"><path d="M0 14V-12M-5-4 0-14 5-4" fill="none" stroke-width="2"/><text y="-23" text-anchor="middle" stroke="none" font-size="13">N</text></g>
    <g transform="translate(35 455)" fill="#65715b" stroke="#65715b"><path d="M0-5V0H120V-5" fill="none"/><text y="18" stroke="none" font-size="12">0</text><text x="120" y="18" text-anchor="end" stroke="none" font-size="12">40 m</text></g>
  </svg>`;
}
