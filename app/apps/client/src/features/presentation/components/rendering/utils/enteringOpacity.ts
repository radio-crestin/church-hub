/**
 * How opaque a line still fading in is right now, from its enter animation's
 * eased progress; 1 once it has finished (or never animated).
 */
export function enteringOpacity(animation: Animation | undefined): number {
  if (!animation || animation.playState !== 'running') return 1
  const progress = animation.effect?.getComputedTiming().progress
  return typeof progress === 'number' ? progress : 1
}
