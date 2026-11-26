import type { MiddlewareHandler } from 'hono'
import { routePath } from 'hono/route'

/**
 * Logs each request as its method, the route pattern it matched
 * (`/signal/:secret/offers`, never the raw path), status and duration.
 * Raw paths and query strings carry room secrets, OAuth codes and states,
 * so they never reach the logs.
 */
export function requestLogger(
  log: (line: string) => void = (line) => console.log(line)
): MiddlewareHandler {
  return async (c, next) => {
    const started = Date.now()
    await next()
    log(
      `${c.req.method} ${routePath(c, -1)} ${c.res.status} ${Date.now() - started}ms`
    )
  }
}
