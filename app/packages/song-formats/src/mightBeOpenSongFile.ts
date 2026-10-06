/**
 * Whether a file could be an OpenSong song, by its path: a `.opensong` or
 * `.xml` file, or one with no extension (how OpenSong itself saves songs).
 * macOS metadata and hidden files are not.
 */
export function mightBeOpenSongFile(filePath: string): boolean {
  const filename = filePath.split(/[/\\]/).pop() || ''
  const lowerPath = filePath.toLowerCase()
  if (lowerPath.includes('__macosx') || filename.startsWith('.')) return false
  return (
    lowerPath.endsWith('.opensong') ||
    lowerPath.endsWith('.xml') ||
    !filename.includes('.')
  )
}
