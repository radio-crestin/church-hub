/** A library folder name: the curated `church-hub`, or `<churchId>-<random>`. */
export function isSourceId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value)
}
