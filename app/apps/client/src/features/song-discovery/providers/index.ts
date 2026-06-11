import { resurseCrestineProvider } from './resurseCrestine'
import type { SourceProvider } from './types'

/**
 * Registry of external song sources. Adding a source = append its provider
 * here. Order is the order shown in the source picker.
 */
export const PROVIDERS: SourceProvider[] = [resurseCrestineProvider]

export function getProvider(id: string): SourceProvider | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

export type { SourceProvider }
