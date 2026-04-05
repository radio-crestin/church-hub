import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'

import { Tooltip } from '../tooltip/Tooltip'

describe('Tooltip', () => {
  test('renders children', () => {
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>,
    )
    expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument()
  })

  test('does not show tooltip content initially', () => {
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>,
    )
    expect(screen.queryByText('Help text')).not.toBeInTheDocument()
  })

  test('shows tooltip on mouse enter', async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>,
    )

    await user.hover(screen.getByText('Hover me'))

    expect(screen.getByText('Help text')).toBeInTheDocument()
  })

  test('hides tooltip on mouse leave', async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>,
    )

    await user.hover(screen.getByText('Hover me'))
    expect(screen.getByText('Help text')).toBeInTheDocument()

    await user.unhover(screen.getByText('Hover me'))
    expect(screen.queryByText('Help text')).not.toBeInTheDocument()
  })

  test('renders tooltip in a portal on document.body when outside dialog', async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="Portal tip">
        <button>Hover</button>
      </Tooltip>,
    )

    await user.hover(screen.getByText('Hover'))

    const tooltip = screen.getByText('Portal tip')
    expect(tooltip.closest('.fixed')).toBeTruthy()
    expect(tooltip.closest('.fixed')?.parentElement).toBe(document.body)
  })

  test('renders tooltip inside dialog when used within a dialog element', async () => {
    const user = userEvent.setup()
    render(
      <dialog open data-testid="dialog">
        <Tooltip content="Dialog tip">
          <button>Hover dialog</button>
        </Tooltip>
      </dialog>,
    )

    await user.hover(screen.getByText('Hover dialog'))

    const tooltip = screen.getByText('Dialog tip')
    const dialog = screen.getByTestId('dialog')
    expect(tooltip.closest('dialog')).toBe(dialog)
  })

  test('renders tooltip with high z-index to appear above modals', async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="High z tip">
        <button>Hover</button>
      </Tooltip>,
    )

    await user.hover(screen.getByText('Hover'))

    const tooltip = screen.getByText('High z tip')
    const portalEl = tooltip.closest('.fixed') as HTMLElement
    expect(portalEl.style.zIndex).toBe('99999')
  })

  test('supports all position variants', async () => {
    const user = userEvent.setup()
    const positions = ['top', 'bottom', 'left', 'right'] as const

    for (const position of positions) {
      const { unmount } = render(
        <Tooltip content={`${position} tip`} position={position}>
          <button>Hover {position}</button>
        </Tooltip>,
      )

      await user.hover(screen.getByText(`Hover ${position}`))
      expect(screen.getByText(`${position} tip`)).toBeInTheDocument()

      await user.unhover(screen.getByText(`Hover ${position}`))
      unmount()
    }
  })

  test('applies custom className', () => {
    const { container } = render(
      <Tooltip content="Tip" className="custom-tooltip">
        <span>Text</span>
      </Tooltip>,
    )
    expect(container.firstChild).toHaveClass('custom-tooltip')
  })
})
