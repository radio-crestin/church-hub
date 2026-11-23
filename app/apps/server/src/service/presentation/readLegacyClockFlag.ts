/**
 * Moves an older design's per-content-type clock switch into `clockEnabled`.
 *
 * Designs saved by earlier versions keep that switch as `clock: { enabled }`.
 * Every reader now looks at `clockEnabled` alone, so the editor's checkbox
 * shows what the screen draws, and the factory default can no longer stand in
 * for a switch the operator did set (T-138). A clock shown before stays shown:
 * either flag being on keeps it on, as the renderer used to decide.
 */
export function readLegacyClockFlag(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const { clock, ...rest } = config
  if (!clock || typeof clock !== 'object' || !('enabled' in clock)) {
    return config
  }
  return {
    ...rest,
    clockEnabled: rest.clockEnabled === true || clock.enabled === true,
  }
}
