/** A request the client must fix (validation) or a limit it hit. */
export class FeatureRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 429 = 400
  ) {
    super(message)
    this.name = 'FeatureRequestError'
  }
}
