/**
 * Whether a program passage ("Ioan 3:16-18") starts at the verse open now
 * ("Ioan 3:16"). A plain prefix match would also take "Ioan 3:1" for
 * "Ioan 3:16", so the number must end where the open reference ends.
 */
export function isSamePassage(
  passageReference: string | null | undefined,
  openReference: string,
): boolean {
  if (!passageReference?.startsWith(openReference)) return false
  const next = passageReference.charAt(openReference.length)
  return !/\d/.test(next)
}
