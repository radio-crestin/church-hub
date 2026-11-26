/** Where a church's encrypted state lives in the states bucket. */
export function churchStateKey(churchId: string): string {
  return `sync-state/${churchId}.bin`
}
