import { bodyLimit } from 'hono/body-limit'

/** A first sync sends its library in chunks well under this. */
const BODY_MAX_BYTES = 8 * 1024 * 1024

/**
 * 413 `too_large` for a /sync body over the limit, counted as it streams
 * in, so a body without (or lying about) its Content-Length is capped too.
 */
export const syncBodyLimit = bodyLimit({
  maxSize: BODY_MAX_BYTES,
  onError: (c) =>
    c.json({ error: 'Request is too large', code: 'too_large' }, 413),
})
