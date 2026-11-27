/** Hashes already computed, by file id, size and modification time. */
const known = new Map<string, string>()

/**
 * sha256 of a media file (hex), its name in the church's bucket. A gallery
 * file never changes under its id, so each is read once per run.
 */
export async function hashMediaFile(
  path: string,
  key: string,
): Promise<string> {
  const cached = known.get(key)
  if (cached) return cached
  const hasher = new Bun.CryptoHasher('sha256')
  const reader = Bun.file(path).stream().getReader()
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    hasher.update(read.value)
  }
  const hash = hasher.digest('hex')
  known.set(key, hash)
  return hash
}
