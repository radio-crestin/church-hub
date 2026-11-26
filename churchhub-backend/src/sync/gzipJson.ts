/** JSON, gzipped with the platform's CompressionStream (Workers, Bun, Node). */
export async function gzipJson(value: unknown): Promise<Uint8Array> {
  const stream = new Blob([JSON.stringify(value)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** The reverse of gzipJson. */
export async function gunzipJson<T>(bytes: ArrayBuffer): Promise<T> {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
  return JSON.parse(await new Response(stream).text()) as T
}
