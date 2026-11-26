/** A numeric attribute, or undefined when it is missing or not a number. */
export function xmlNumber(
  element: Element | null | undefined,
  name: string,
): number | undefined {
  const value = element?.getAttribute(name)
  if (value == null || value === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}
