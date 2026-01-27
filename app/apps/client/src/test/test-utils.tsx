import { type RenderOptions, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'

import i18n from '../i18n/config'

interface WrapperProps {
  children: ReactNode
}

function TestProviders({ children }: WrapperProps) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}

function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: TestProviders, ...options })
}

// Re-export everything from testing-library
export * from '@testing-library/react'
export { customRender as render }
