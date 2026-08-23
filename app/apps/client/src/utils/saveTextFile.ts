interface SaveTextFileOptions {
  content: string
  defaultFilename: string
  /** Label shown for the file type in the desktop save dialog. */
  filterName?: string
  /** Extensions offered by the desktop save dialog. */
  extensions?: string[]
}

/**
 * Hands a text file to the user.
 *
 * In the desktop app this opens Tauri's native save dialog; in the browser it
 * falls back to a blob download carrying the suggested filename.
 *
 * Returns false when the desktop dialog was dismissed without picking a path.
 */
export async function saveTextFile({
  content,
  defaultFilename,
  filterName = 'Text File',
  extensions = ['txt'],
}: SaveTextFileOptions): Promise<boolean> {
  const isTauri =
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

  if (isTauri) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')

    const savePath = await save({
      defaultPath: defaultFilename,
      filters: [{ name: filterName, extensions }],
    })

    if (!savePath) return false

    await writeTextFile(savePath, content)
    return true
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
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
