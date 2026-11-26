/** `base` with every field `over` sets (not undefined) put over it. */
export function mergeDefined<T extends object>(base: T, over: Partial<T>): T {
  const result = { ...base }
  for (const [key, value] of Object.entries(over)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value
  }
  return result
}
