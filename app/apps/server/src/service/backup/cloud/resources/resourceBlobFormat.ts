/**
 * A resource blob's contents: rows of whole tables, canonical so the same
 * rows always give the same bytes (and the same SHA-256 name).
 *
 *   {"format":"church-hub-resource","version":1}
 *   {"table":"bible_verses","columns":["id","translation_id",…]}
 *   [1,1,…]                one JSON array per row, in primary-key order
 *   {"table":…}            the next section
 *
 * Stored gzipped; named by the SHA-256 of these (uncompressed) bytes.
 */
export interface ResourceSection {
  table: string
  columns: string[]
  rows: unknown[][]
}

const HEADER = JSON.stringify({ format: 'church-hub-resource', version: 1 })

export function serializeSections(sections: ResourceSection[]): Buffer {
  const lines = [HEADER]
  for (const { table, columns, rows } of sections) {
    lines.push(JSON.stringify({ table, columns }))
    for (const row of rows) lines.push(JSON.stringify(row))
  }
  return Buffer.from(`${lines.join('\n')}\n`, 'utf8')
}

export function parseSections(bytes: Buffer): ResourceSection[] {
  const [header, ...lines] = bytes.toString('utf8').trimEnd().split('\n')
  if (header !== HEADER) throw new Error('backup_unreadable')
  const sections: ResourceSection[] = []
  for (const line of lines) {
    const value = JSON.parse(line) as unknown
    if (Array.isArray(value)) {
      const current = sections.at(-1)
      if (!current) throw new Error('backup_unreadable')
      current.rows.push(value)
    } else {
      const { table, columns } = value as { table: string; columns: string[] }
      sections.push({ table, columns, rows: [] })
    }
  }
  return sections
}
