import type { ChromaClient, Collection } from 'chromadb'

import { getChromaPort } from './serverProcess'
import type { ChromaCollectionName } from './types'
import { CHROMA_COLLECTIONS } from './types'

let client: ChromaClient | null = null
let clientPort: number | null = null
const collections = new Map<ChromaCollectionName, Collection>()

/**
 * Returns the HTTP client for the local Chroma server.
 * Requires startChromaServer() to have completed. Port-aware: a server
 * restart on a new port invalidates the cached client and collections.
 */
export async function getChromaClient(): Promise<ChromaClient> {
  const port = getChromaPort()
  if (!port) {
    throw new Error('Chroma server is not running')
  }
  if (!client || clientPort !== port) {
    const { ChromaClient: Client } = await import('chromadb')
    // 127.0.0.1 explicitly — the child binds IPv4; `localhost` may resolve
    // to ::1 depending on the resolver and miss the server.
    client = new Client({ host: '127.0.0.1', port, ssl: false })
    clientPort = port
    collections.clear()
  }
  return client
}

/**
 * Returns (and caches) a Chroma collection. Collections are created with
 * cosine space; we always pass embeddings explicitly (computed via
 * embedder.ts), so no embedding function is attached to the collection.
 */
export async function getChromaCollection(
  name: ChromaCollectionName,
): Promise<Collection> {
  const cached = collections.get(name)
  if (cached) return cached

  const chroma = await getChromaClient()
  const collection = await chroma.getOrCreateCollection({
    name,
    configuration: { hnsw: { space: 'cosine' } },
    embeddingFunction: null,
  })
  collections.set(name, collection)
  return collection
}

/**
 * Drops and recreates all Chroma collections (used by restore/factory-reset
 * before a full resync — Chroma data is derived from SQLite).
 */
export async function resetChromaCollections(): Promise<void> {
  const chroma = await getChromaClient()
  for (const name of Object.values(CHROMA_COLLECTIONS)) {
    try {
      await chroma.deleteCollection({ name })
    } catch {
      // collection may not exist yet
    }
    collections.delete(name)
  }
}

/** Clears cached client/collections (after server restart). */
export function clearChromaClientCache(): void {
  client = null
  clientPort = null
  collections.clear()
}
