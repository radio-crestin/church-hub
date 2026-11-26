import JSZip from 'jszip'

import { resolvePartPath } from './resolvePartPath'
import { parseXml } from '../xml/parseXml'

/** One relationship of a part: what it points to. */
export interface PptxRelationship {
  /** The zip path, or the URL of an external target. */
  target: string
  /** Its type's last segment: `slideLayout`, `image`, `video`, `media`, … */
  type: string
  external: boolean
}

/** The parts of a .pptx file, each read once. */
export interface PptxPackage {
  /** The part as XML, or null when the file has no such part. */
  xml: (path: string) => Promise<Document | null>
  /** The part's relationships by id (from its `_rels/<name>.rels`). */
  rels: (path: string) => Promise<Map<string, PptxRelationship>>
  blob: (path: string) => Promise<Blob | null>
  has: (path: string) => boolean
}

function relsPathOf(path: string): string {
  const slash = path.lastIndexOf('/')
  return `${path.slice(0, slash + 1)}_rels/${path.slice(slash + 1)}.rels`
}

/** Opens a .pptx file (a zip of XML parts and media); throws when it is none. */
export async function openPptxPackage(
  data: ArrayBuffer | Blob,
): Promise<PptxPackage> {
  const zip = await JSZip.loadAsync(data)
  const docs = new Map<string, Promise<Document | null>>()
  const relations = new Map<string, Promise<Map<string, PptxRelationship>>>()

  const xml = (path: string) => {
    let doc = docs.get(path)
    if (!doc) {
      const file = zip.file(path)
      doc = file
        ? file.async('string').then((text) => parseXml(text, path))
        : Promise.resolve(null)
      docs.set(path, doc)
    }
    return doc
  }

  const readRels = async (path: string) => {
    const map = new Map<string, PptxRelationship>()
    const doc = await xml(relsPathOf(path))
    for (const rel of Array.from(doc?.getElementsByTagName('*') ?? [])) {
      if (rel.localName !== 'Relationship') continue
      const id = rel.getAttribute('Id')
      const target = rel.getAttribute('Target') ?? ''
      if (!id) continue
      const external = rel.getAttribute('TargetMode') === 'External'
      map.set(id, {
        target: external ? target : resolvePartPath(path, target),
        type: (rel.getAttribute('Type') ?? '').split('/').pop() ?? '',
        external,
      })
    }
    return map
  }

  return {
    xml,
    rels: (path) => {
      let map = relations.get(path)
      if (!map) {
        map = readRels(path)
        relations.set(path, map)
      }
      return map
    },
    blob: async (path) => {
      const file = zip.file(path)
      return file ? file.async('blob') : null
    },
    has: (path) => zip.file(path) !== null,
  }
}
