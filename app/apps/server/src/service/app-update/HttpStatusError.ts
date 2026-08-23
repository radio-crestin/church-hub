/** GitHub answered, but not with the artifact. */
export class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`)
    this.name = 'HttpStatusError'
  }
}
