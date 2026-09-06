import { Book, Camera, Megaphone, Music, User } from 'lucide-react'

import type { ScheduleItem } from '../types'

interface ScheduleItemTypeIconProps {
  item: ScheduleItem
  /**
   * `md` is the program page's avatar-style disc; `sm` is the bare glyph the
   * compact Programe rows use, where a disc would eat the row's height.
   */
  size?: 'sm' | 'md'
}

/** Icon + colour for one program item kind. One table, every list. */
function describeKind(item: ScheduleItem) {
  if (item.itemType === 'song') {
    return {
      Icon: Music,
      tint: 'text-indigo-600 dark:text-indigo-400',
      disc: 'bg-indigo-100 dark:bg-indigo-900/30',
    }
  }
  if (item.itemType === 'bible_passage') {
    return {
      Icon: Book,
      tint: 'text-teal-600 dark:text-teal-400',
      disc: 'bg-teal-100 dark:bg-teal-900/30',
    }
  }
  if (item.slideType === 'versete_tineri') {
    return {
      Icon: User,
      tint: 'text-green-600 dark:text-green-400',
      disc: 'bg-green-100 dark:bg-green-900/30',
    }
  }
  if (item.slideType === 'scene') {
    return {
      Icon: Camera,
      tint: 'text-violet-600 dark:text-violet-400',
      disc: 'bg-violet-100 dark:bg-violet-900/30',
    }
  }
  return {
    Icon: Megaphone,
    tint: 'text-orange-600 dark:text-orange-400',
    disc: 'bg-orange-100 dark:bg-orange-900/30',
  }
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
  const { Icon, tint, disc } = describeKind(item)

  if (size === 'sm') {
    return <Icon size={13} className={`shrink-0 ${tint}`} aria-hidden />
  }

  return (
    <div
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${disc}`}
    >
      <Icon size={16} className={tint} aria-hidden />
    </div>
  )
}
