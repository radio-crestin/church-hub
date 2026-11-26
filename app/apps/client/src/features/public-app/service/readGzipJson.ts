/** A gzipped JSON object of the bucket (snapshots and segments). */
export async function readGzipJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`GET ${url}: HTTP ${response.status}`)
  }
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'))
  return JSON.parse(await new Response(stream).text()) as T
}
