import { BUNDLED_TEMPLATES } from '../../slide-templates/bundledTemplates'
import { getBundledTemplateId } from '../../slide-templates/getSlideTemplates'

/** The bundled templates a topic may start with, by id, in their order. */
export function getTopicTemplatePool(): number[] {
  return BUNDLED_TEMPLATES.filter((template) => template.forTopics)
    .map((template) => getBundledTemplateId(template.key))
    .filter((id): id is number => id !== null)
}

/** FNV-1a: the same number for the same key, on every install. */
function hashKey(key: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * The template a topic draws with until the operator picks another: one of
 * the pool, the same for the same topic every time.
 */
export function getFittingTopicTemplateId(
  topicKey: string,
  pool: number[],
): number | null {
  return pool[hashKey(topicKey) % pool.length] ?? null
}
