import { SyncError } from '../sync/SyncError'
import { churchOfSource } from './churchOfSource'
import { isSourceId } from './isSourceId'
import type { FeaturedSource } from './types'

/** Sources the list can hold. */
const MAX_SOURCES = 100

function invalid(message: string): never {
  throw new SyncError(400, 'invalid_request', message)
}

function text(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, max)
    : null
}

/**
 * The featured list a curator or the build sent: libraries Church Hub
 * manages (no church's), each once, each with a name and a category.
 */
export function parseFeatured(body: unknown): FeaturedSource[] {
  const sources = (body as { sources?: unknown })?.sources
  if (!Array.isArray(sources) || sources.length > MAX_SOURCES) {
    invalid(`sources must be a list of at most ${MAX_SOURCES}`)
  }
  const seen = new Set<string>()
  return sources.map((value) => {
    const source = (value ?? {}) as Record<string, unknown>
    const sourceId = typeof source.sourceId === 'string' ? source.sourceId : ''
    if (!isSourceId(sourceId) || churchOfSource(sourceId) || seen.has(sourceId)) {
      invalid(`${sourceId || 'A source'} is not a library Church Hub manages`)
    }
    seen.add(sourceId)
    const name = text(source.name, 200)
    const categoryName = text(source.categoryName, 200)
    if (!name || !categoryName) invalid('Each source needs a name and a category')
    return {
      sourceId,
      name,
      categoryName,
      description: text(source.description, 500),
      homepage: text(source.homepage, 500),
      license: text(source.license, 200),
    }
  })
}
