import type { TermGroup } from './types'

/** Finds, for one written form of a word, the typos it costs each group. */
export type VariantMatcher = (form: string, edits: Int8Array) => void

interface PrefixVariant {
  text: string
  group: number
  edits: number
}

/**
 * Compiles the groups' variants once per query: whole words into a lookup
 * table, beginnings into a short list. The matcher lowers `edits[group]` to
 * the fewest typos any variant of that group needs to be `form`.
 */
export function buildVariantMatcher(groups: TermGroup[]): VariantMatcher {
  const words = new Map<string, Array<[group: number, edits: number]>>()
  const prefixes: PrefixVariant[] = []
  groups.forEach((group, index) => {
    for (const variant of group.variants) {
      const text = variant.text.replaceAll(' ', '')
      if (variant.prefix) {
        prefixes.push({ text, group: index, edits: variant.edits })
      } else {
        const entries = words.get(text) ?? []
        entries.push([index, variant.edits])
        words.set(text, entries)
      }
    }
  })

  return (form, edits) => {
    const entries = words.get(form)
    if (entries) {
      for (const [group, cost] of entries) {
        if (cost < edits[group]) edits[group] = cost
      }
    }
    for (const prefix of prefixes) {
      if (prefix.edits < edits[prefix.group] && form.startsWith(prefix.text)) {
        edits[prefix.group] = prefix.edits
      }
    }
  }
}
