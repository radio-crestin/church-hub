import type { PptxMediaFile } from '../types'

export interface PptxMediaRegistry {
  /** The token standing for the file at `path` until it is uploaded. */
  add: (file: Omit<PptxMediaFile, 'token'>) => string
  files: () => PptxMediaFile[]
}

/** The deck's media files, each once however many slides show it. */
export function createMediaRegistry(): PptxMediaRegistry {
  const byPath = new Map<string, PptxMediaFile>()
  return {
    add: (file) => {
      const known = byPath.get(file.path)
      if (known) return known.token
      const token = `pptx-media-${byPath.size}`
      byPath.set(file.path, { ...file, token })
      return token
    },
    files: () => [...byPath.values()],
  }
}
