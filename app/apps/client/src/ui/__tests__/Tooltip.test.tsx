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

  test('applies top position styles by default', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Tooltip content="Top tip">
        <button>Hover</button>
      </Tooltip>,
    )

    await user.hover(screen.getByText('Hover'))

    const tooltipWrapper = container.querySelector('.bottom-full')
    expect(tooltipWrapper).toBeInTheDocument()
  })

  test('applies bottom position styles', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Tooltip content="Bottom tip" position="bottom">
        <button>Hover</button>
      </Tooltip>,
    )

    await user.hover(screen.getByText('Hover'))

    const tooltipWrapper = container.querySelector('.top-full')
    expect(tooltipWrapper).toBeInTheDocument()
  })

  test('applies left position styles', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Tooltip content="Left tip" position="left">
        <button>Hover</button>
      </Tooltip>,
    )

    await user.hover(screen.getByText('Hover'))

    const tooltipWrapper = container.querySelector('.right-full')
    expect(tooltipWrapper).toBeInTheDocument()
  })

  test('applies right position styles', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Tooltip content="Right tip" position="right">
        <button>Hover</button>
      </Tooltip>,
    )

    await user.hover(screen.getByText('Hover'))

    const tooltipWrapper = container.querySelector('.left-full')
    expect(tooltipWrapper).toBeInTheDocument()
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
