/** True for light colours (white, yellow) that need dark text or an outline. */
export function isLightColor(hex: string): boolean {
  const value = Number.parseInt(hex.slice(1), 16)
  const red = (value >> 16) & 255
  const green = (value >> 8) & 255
  const blue = value & 255
  return (red * 299 + green * 587 + blue * 114) / 1000 > 160
}
