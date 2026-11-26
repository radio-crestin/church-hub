import type {
  DeckAnimation,
  DeckClickGroup,
  DeckSlide,
  DeckTimedAnimation,
} from '../types'

/** The slide's animations in play order: its `animationOrder`, else element order. */
function orderedAnimations(
  slide: DeckSlide,
): { elementId: string; animation: DeckAnimation }[] {
  const all = slide.elements.flatMap((element) =>
    (element.animations ?? []).map((animation) => ({
      elementId: element.id,
      animation,
    })),
  )
  if (!slide.animationOrder) return all
  const rank = new Map(slide.animationOrder.map((id, index) => [id, index]))
  const unranked = all.length
  return [...all].sort(
    (a, b) =>
      (rank.get(a.animation.id) ?? unranked) -
      (rank.get(b.animation.id) ?? unranked),
  )
}

/**
 * A slide's animations as PowerPoint plays them, in click groups: group 0 is
 * what plays by itself as the slide comes in (the leading "with previous" and
 * "after previous" effects, possibly none); each "on click" effect starts a
 * new group with the "with"/"after previous" effects that follow it. Each
 * effect's start in its group: "with previous" starts with the effect before
 * it, "after previous" once everything before it in the group has ended, each
 * plus its own delay. Mirrors the server's `slideTimeline`.
 */
export function slideTimeline(slide: DeckSlide): DeckClickGroup[] {
  const groups: DeckClickGroup[] = [[]]
  let triggerMs = 0
  let groupEndMs = 0
  for (const { elementId, animation } of orderedAnimations(slide)) {
    if (animation.trigger === 'click') {
      groups.push([])
      triggerMs = 0
      groupEndMs = 0
    } else if (animation.trigger === 'after_previous') {
      triggerMs = groupEndMs
    }
    const startMs = triggerMs + animation.delayMs
    groupEndMs = Math.max(groupEndMs, startMs + animation.durationMs)
    const timed: DeckTimedAnimation = { elementId, animation, startMs }
    groups[groups.length - 1]?.push(timed)
  }
  return groups
}
