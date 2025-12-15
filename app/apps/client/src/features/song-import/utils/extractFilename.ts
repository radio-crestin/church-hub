/**
 * Extracts the filename from a full file path
 * Handles both Unix (/) and Windows (\) path separators
 */
export function extractFilename(filePath: string | null): string | null {
  if (!filePath) return null
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1] || null
}
