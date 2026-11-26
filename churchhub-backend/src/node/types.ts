/** The process environment the Node entry reads its settings from. */
export type NodeSettings = Record<string, string | undefined>

/** The few Redis commands the adapters use (node-redis' client has them). */
export interface RedisCommands {
  get(key: string): Promise<string | null>
  set(
    key: string,
    value: string,
    options?: { expiration: { type: 'EX'; value: number } }
  ): Promise<unknown>
  del(key: string): Promise<unknown>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<unknown>
}

/** A fixed-window limit: `limit` calls per key every `periodSeconds`. */
export interface RateLimitRule {
  limit: number
  periodSeconds: number
}
