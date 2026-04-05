import { describe, expect, test, vi } from 'vitest'

import { render, screen } from '../../test/test-utils'
import NotFound from '../NotFound'

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode
    to: string
    className?: string
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

describe('NotFound', () => {
  test('renders default "page not found" message', () => {
    render(<NotFound />)
    // The i18n key common:errors.pageNotFound should render
    expect(screen.getByText(/pageNotFound|not found|page/i)).toBeInTheDocument()
  })

  test('renders custom children instead of default message', () => {
    render(<NotFound>Custom not found content</NotFound>)
    expect(screen.getByText('Custom not found content')).toBeInTheDocument()
  })

  test('renders go back button', () => {
    render(<NotFound />)
    expect(
      screen.getByRole('button', { name: /go\s*back|back/i }),
    ).toBeInTheDocument()
  })

  test('renders start over link', () => {
    render(<NotFound />)
    expect(
      screen.getByRole('link', { name: /start\s*over|start/i }),
    ).toBeInTheDocument()
  })

  test('start over link points to /present', () => {
    render(<NotFound />)
    const link = screen.getByRole('link', { name: /start\s*over|start/i })
    expect(link).toHaveAttribute('href', '/present')
  })

  test('go back button calls window.history.back', async () => {
    const historyBackSpy = vi
      .spyOn(window.history, 'back')
      .mockImplementation(() => {})

    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()

    render(<NotFound />)
    await user.click(screen.getByRole('button', { name: /go\s*back|back/i }))

    expect(historyBackSpy).toHaveBeenCalledOnce()
    historyBackSpy.mockRestore()
  })
})
