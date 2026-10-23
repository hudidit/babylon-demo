/** Static, world-anchored canopy/contact darkening. Evaluated only while building ground colors. */
export function forestGroundShade(groups: readonly { trees: readonly { x: number; y: number; height: number; width?: number }[] }[]) {
  const buckets = new Map<string, { x: number; y: number; radius: number }[]>();
  for (const group of groups) for (const tree of group.trees) {
    const { x, y } = tree, radius = (tree.width ?? tree.height * 1.6) * .6;
    for (let i = Math.floor((x - radius) / 32); i <= Math.floor((x + radius) / 32); i++)
      for (let j = Math.floor((y - radius) / 32); j <= Math.floor((y + radius) / 32); j++) {
        const key = `${i},${j}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push({ x, y, radius });
      }
  }
  return (x: number, y: number) => {
    let darkness = 0;
    for (const tree of buckets.get(`${Math.floor(x / 32)},${Math.floor(y / 32)}`) || []) {
      const distance = Math.hypot(x - tree.x, y - tree.y), u = distance / tree.radius;
      if (u < 1) darkness = Math.max(darkness,
        .56 * (1 - u * u) ** 2 + .16 * (1 - Math.min(1, distance / 1.6)) ** 2);
    }
    return 1 - darkness;
  };
}
