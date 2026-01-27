import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { Button } from '../button/Button'

describe('Button', () => {
  test('renders children correctly', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  test('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Save</Button>)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(handleClick).toHaveBeenCalledOnce()
  })

  test('does not call onClick when disabled', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(
      <Button onClick={handleClick} disabled>
        Save
      </Button>,
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(handleClick).not.toHaveBeenCalled()
  })

  test('applies disabled styles when disabled', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button', { name: 'Disabled' })

    expect(button).toBeDisabled()
    expect(button).toHaveClass('disabled:opacity-50')
  })

  test('applies variant styles correctly', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-indigo-600')

    rerender(<Button variant="danger">Danger</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-red-600')

    rerender(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-gray-100')
  })

  test('applies size styles correctly', () => {
    const { rerender } = render(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button')).toHaveClass('px-3', 'py-1.5')

    rerender(<Button size="lg">Large</Button>)
    expect(screen.getByRole('button')).toHaveClass('px-6', 'py-3')
  })
})
