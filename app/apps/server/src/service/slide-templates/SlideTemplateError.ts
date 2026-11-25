/** A template request that can't be done; `status` is the HTTP status to answer. */
export class SlideTemplateError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message)
    this.name = 'SlideTemplateError'
  }
}
