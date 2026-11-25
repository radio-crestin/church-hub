import type { ConfigurableItemType, ItemConfigs } from './types'
import { parseSlideDeck } from '../slides-deck/parseSlideDeck'

/** A switch an older item may not have yet (off). */
function isOptionalFlag(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean'
}

function isCount(value: unknown): boolean {
  return value === null || (Number.isInteger(value) && (value as number) > 0)
}

/**
 * Checks an item's settings (a Slides item's deck) as the API receives them;
 * throws on anything else, so a bad item is refused instead of stored.
 */
export function parseItemConfig<T extends ConfigurableItemType>(
  type: T,
  value: unknown,
): ItemConfigs[T] {
  // A deck is rebuilt field by field, its HTML sanitized.
  if (type === 'slides') return parseSlideDeck(value) as ItemConfigs[T]
  const c = value as Record<string, unknown> | null
  const valid = (() => {
    if (!c || typeof c !== 'object') return false
    switch (type) {
      case 'music':
        return (
          typeof c.shuffle === 'boolean' &&
          ((c.source === 'folder' && Number.isInteger(c.folderId)) ||
            (c.source === 'tracks' &&
              Array.isArray(c.fileIds) &&
              c.fileIds.length > 0 &&
              c.fileIds.every(Number.isInteger)))
        )
      case 'video':
        return (
          isOptionalFlag(c.loop) &&
          isOptionalFlag(c.background) &&
          (c.source === 'random' ||
            (c.source === 'file' && typeof c.mediaId === 'string'))
        )
      case 'verses':
        return (
          Number.isInteger(c.translationId) &&
          isCount(c.count) &&
          ((c.source === 'book' &&
            typeof c.bookCode === 'string' &&
            c.count !== null) ||
            (c.source === 'topic' && typeof c.topicKey === 'string'))
        )
      case 'versete':
        return isCount(c.count)
      default:
        return false
    }
  })()
  if (!valid) throw new Error(`Invalid ${type} item settings`)
  if (type === 'video' && c) {
    return {
      ...c,
      loop: c.loop === true,
      background: c.background === true,
    } as ItemConfigs[T]
  }
  return c as ItemConfigs[T]
}
