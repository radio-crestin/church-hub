import { createContext, useContext } from 'react'

/**
 * Whether the texts drawn here type themselves in when their template asks
 * for it. Off by default, so thumbnails and editors show the finished text;
 * the projected screen and the operator's live preview turn it on.
 */
export const TypewriterContext = createContext(false)

export function useTypewriterEnabled(): boolean {
  return useContext(TypewriterContext)
}
