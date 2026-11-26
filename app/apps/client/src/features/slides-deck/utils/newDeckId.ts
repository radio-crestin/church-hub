/** A fresh id for a slide, element or animation (also on plain-HTTP pages). */
export function newDeckId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}
