/**
 * The width a flex row's children need side by side with none of them cut: a
 * child that clips its text (a `truncate` title) counts at its whole text
 * width, not at the width it has been squeezed to.
 *
 * Read from the children, never from the row's own box, which is whatever
 * room it was given — measuring that would let the answer feed back into the
 * room it decides.
 */
export function measureContentWidth(row: HTMLElement): number {
  const children = [...row.children].filter(
    (child) => child.getClientRects().length > 0,
  )
  const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0

  return children.reduce(
    (total, child) => {
      const style = getComputedStyle(child)
      // A child that clips (a `truncate` title) is measured the same way cut or
      // whole: its scrollWidth, rounded to a whole pixel, plus one so a title a
      // fraction wider than that does not still end in an ellipsis. Measuring
      // it by its box only while whole made the answer differ by a pixel
      // between the two layouts it decides between, and the header flipped
      // between them until React gave up (T-016).
      const width =
        style.overflowX === 'visible'
          ? child.getBoundingClientRect().width
          : child.scrollWidth + 1
      return (
        total +
        width +
        Number.parseFloat(style.marginLeft) +
        Number.parseFloat(style.marginRight)
      )
    },
    gap * Math.max(0, children.length - 1),
  )
}
