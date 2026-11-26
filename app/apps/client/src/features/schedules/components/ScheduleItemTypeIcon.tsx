import {
  Book,
  BookOpen,
  Camera,
  Film,
  ListMusic,
  Megaphone,
  Music,
  Presentation,
  User,
} from 'lucide-react'

import type { ScheduleItem } from '../types'

interface ScheduleItemTypeIconProps {
  item: ScheduleItem
  /**
   * `md` sits in a 32px slot on the program page; `sm` is the bare glyph the
   * compact Programe rows use.
   */
  size?: 'sm' | 'md'
}

/** The icon for one program item kind. One table, every list. */
function describeKind(item: ScheduleItem) {
  if (item.itemType === 'song') {
    return { Icon: Music }
  }
  if (item.itemType === 'music') {
    return { Icon: ListMusic }
  }
  if (item.itemType === 'video') {
    return { Icon: Film }
  }
  if (item.itemType === 'slides') {
    return { Icon: Presentation }
  }
  if (item.itemType === 'verses') {
    return { Icon: BookOpen }
  }
  if (item.itemType === 'bible_passage') {
    return { Icon: Book }
  }
  if (item.slideType === 'versete_tineri') {
    return { Icon: User }
  }
  if (item.slideType === 'scene') {
    return { Icon: Camera }
  }
  return { Icon: Megaphone }
}

/**
 * Tells a program item's kind apart at a glance — a song from a reading from an
 * announcement. Shared so the program page's list and the Programe panel can
 * never disagree about what a scene looks like.
 */
export function ScheduleItemTypeIcon({
  item,
  size = 'md',
}: ScheduleItemTypeIconProps) {
  const { Icon } = describeKind(item)

  if (size === 'sm') {
    return (
      <Icon
        size={14}
        strokeWidth={1.75}
        className="shrink-0 text-fg-label"
        aria-hidden
      />
    )
  }

  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
      <Icon size={16} strokeWidth={1.5} className="text-fg-label" aria-hidden />
    </div>
  )
}
