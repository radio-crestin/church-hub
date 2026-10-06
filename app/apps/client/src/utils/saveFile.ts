interface SaveFileOptions {
  content: string | Uint8Array
  defaultFilename: string
  /** Label shown for the file type in the desktop save dialog. */
  filterName: string
  /** Extensions offered by the desktop save dialog. */
  extensions: string[]
  /** MIME type of the browser download. */
  mimeType: string
}

/**
 * Hands a file to the user.
 *
 * In the desktop app this opens Tauri's native save dialog; in the browser it
 * falls back to a blob download carrying the suggested filename.
 *
 * Returns false when the desktop dialog was dismissed without picking a path.
 */
export async function saveFile({
  content,
  defaultFilename,
  filterName,
  extensions,
  mimeType,
}: SaveFileOptions): Promise<boolean> {
  const isTauri =
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

  if (isTauri) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile, writeTextFile } = await import('@tauri-apps/plugin-fs')

    const savePath = await save({
      defaultPath: defaultFilename,
      filters: [{ name: filterName, extensions }],
    })

    if (!savePath) return false

    if (typeof content === 'string') await writeTextFile(savePath, content)
    else await writeFile(savePath, content)
    return true
  }

  const blob = new Blob([content as BlobPart], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = defaultFilename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  return true
}
