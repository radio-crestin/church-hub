import { getNowPlayingQueue, reorderNowPlaying } from './now-playing'
import type { NowPlayingItem, QueueOrder } from './types'

// Each gets a fresh slice of the queue, so it may sort it in place.
const byOrder: Record<
  QueueOrder,
  (items: NowPlayingItem[]) => NowPlayingItem[]
> = {
  // Item ids grow as tracks are added, so they keep the order they came in.
  in_order: (items) => items.sort((a, b) => a.id - b.id),
  random: (items) =>
    items
      .map((item) => ({ item, key: Math.random() }))
      .sort((a, b) => a.key - b.key)
      .map(({ item }) => item),
  most_played: (items) =>
    items.sort((a, b) => b.file.playCount - a.file.playCount || a.id - b.id),
  least_played: (items) =>
    items.sort((a, b) => a.file.playCount - b.file.playCount || a.id - b.id),
}

/**
 * Orders the tracks after `currentIndex` (all of them when nothing plays);
 * the one playing and those before it stay where they are.
 */
export function orderUpcoming(order: QueueOrder, currentIndex: number): void {
  const queue = getNowPlayingQueue()
  const keep = queue.slice(0, currentIndex + 1)
  const upcoming = byOrder[order](queue.slice(currentIndex + 1))
  reorderNowPlaying([...keep, ...upcoming].map((item) => item.id))
}
