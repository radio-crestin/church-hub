import type { SlideToken } from './splitSlideLines'

/**
 * Groups a line's tokens into the runs drawn together: the word boxes of one
 * word (a word a styled run cuts in two) form one group, kept from wrapping
 * apart; every other token stands alone. Returns token indexes per group.
 */
export function groupWordPieces(tokens: SlideToken[]): number[][] {
  const groups: number[][] = []
  tokens.forEach((token, index) => {
    const last = groups.at(-1)
    if (token.glides && last && tokens[last.at(-1) ?? -1]?.glides) {
      last.push(index)
    } else {
      groups.push([index])
    }
  })
  return groups
}
