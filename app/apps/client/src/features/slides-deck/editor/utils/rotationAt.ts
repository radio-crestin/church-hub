/**
 * The rotation (degrees, -180..180) that turns a box's top towards `pointer`
 * around its `center`; with `snap` (Shift), in steps of 15°.
 */
export function rotationAt(
  center: { x: number; y: number },
  pointer: { x: number; y: number },
  snap: boolean,
): number {
  const degrees =
    (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) / Math.PI +
    90
  const stepped = snap ? Math.round(degrees / 15) * 15 : Math.round(degrees)
  return ((((stepped + 180) % 360) + 360) % 360) - 180
}
