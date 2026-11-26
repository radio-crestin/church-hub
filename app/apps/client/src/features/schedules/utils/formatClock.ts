/** 83.4 → "1:23"; with tenths, "1:23.4". */
export function formatClock(seconds: number, tenths = false): string {
  const clamped = Math.max(0, seconds)
  const whole = Math.floor(clamped)
  const clock = `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
  return tenths
    ? `${clock}.${Math.floor((clamped - whole) * 10 + 1e-6)}`
    : clock
}
