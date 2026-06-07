import { mkdirSync } from 'node:fs'

import { createLogger } from '../../utils/logger'
import { getModelsCacheDir } from '../../utils/paths'

const logger = createLogger('chroma-embedder')

interface Embedder {
  generate: (texts: string[]) => Promise<number[][]>
}

let embedderPromise: Promise<Embedder> | null = null

/**
 * Lazily constructs the local embedding function (all-MiniLM-L6-v2 via
 * transformers.js/ONNX). Loaded on demand so it never slows server boot, and
 * the model is cached under <data-dir>/models — downloaded once, offline
 * afterwards.
 */
export function getEmbedder(): Promise<Embedder> {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const cacheDir = getModelsCacheDir()
      mkdirSync(cacheDir, { recursive: true })

      const transformers = await import('@huggingface/transformers')
      transformers.env.cacheDir = cacheDir

      const { DefaultEmbeddingFunction } = await import(
        '@chroma-core/default-embed'
      )
      // q8 quantization: 2-4x faster on CPU than the fp32 default with
      // negligible retrieval-quality loss for MiniLM. Must stay consistent
      // between indexing and querying — change requires a full resync.
      const ef = new DefaultEmbeddingFunction({
        dtype: (process.env.CHROMA_EMBED_DTYPE as 'q8' | undefined) ?? 'q8',
      })

      const t = performance.now()
      await ef.generate(['warmup'])
      logger.info(
        `Embedding model ready in ${(performance.now() - t).toFixed(0)}ms (cache: ${cacheDir})`,
      )
      return ef
    })()
    embedderPromise.catch((error) => {
      logger.error(`Failed to initialize embedding model: ${error}`)
      embedderPromise = null
    })
  }
  return embedderPromise
}

/**
 * Embeds texts in batches to bound memory usage during full syncs.
 */
export async function embedInBatches(
  texts: string[],
  batchSize = 100,
): Promise<number[][]> {
  const embedder = await getEmbedder()
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    out.push(...(await embedder.generate(batch)))
  }
  return out
}
