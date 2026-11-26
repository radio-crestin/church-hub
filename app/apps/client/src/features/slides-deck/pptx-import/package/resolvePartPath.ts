/**
 * The zip path a relationship's target points to, from the part that holds
 * it: `../media/image1.png` from `ppt/slides/slide1.xml` is
 * `ppt/media/image1.png`; a target starting with `/` is from the root.
 */
export function resolvePartPath(fromPart: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const parts = fromPart.split('/').slice(0, -1)
  for (const step of target.split('/')) {
    if (step === '..') parts.pop()
    else if (step !== '.' && step !== '') parts.push(step)
  }
  return parts.join('/')
}
