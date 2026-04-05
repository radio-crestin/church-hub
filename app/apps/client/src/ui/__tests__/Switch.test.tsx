import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { Switch } from '../switch/Switch'

describe('Switch', () => {
  test('renders a switch role element', () => {
    render(<Switch />)
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  test('has aria-checked false by default', () => {
    render(<Switch />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  test('has aria-checked true when checked', () => {
    render(<Switch checked={true} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  test('calls onCheckedChange with toggled value when clicked', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Switch checked={false} onCheckedChange={handleChange} />)

    await user.click(screen.getByRole('switch'))

    expect(handleChange).toHaveBeenCalledOnce()
    expect(handleChange).toHaveBeenCalledWith(true)
  })

  test('calls onCheckedChange with false when unchecking', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Switch checked={true} onCheckedChange={handleChange} />)

    await user.click(screen.getByRole('switch'))

    expect(handleChange).toHaveBeenCalledOnce()
    expect(handleChange).toHaveBeenCalledWith(false)
  })

  test('does not call onCheckedChange when disabled', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Switch checked={false} onCheckedChange={handleChange} disabled />)

    await user.click(screen.getByRole('switch'))

    expect(handleChange).not.toHaveBeenCalled()
  })

  test('is disabled when disabled prop is true', () => {
    render(<Switch disabled />)
    expect(screen.getByRole('switch')).toBeDisabled()
  })

  test('applies checked background color', () => {
    render(<Switch checked={true} />)
    expect(screen.getByRole('switch')).toHaveClass('bg-indigo-600')
  })

  test('applies unchecked background color', () => {
    render(<Switch checked={false} />)
    expect(screen.getByRole('switch')).toHaveClass('bg-gray-200')
  })

  test('applies disabled opacity class', () => {
    render(<Switch disabled />)
    expect(screen.getByRole('switch')).toHaveClass('opacity-50')
  })

  test('applies custom className', () => {
    render(<Switch className="extra-class" />)
    expect(screen.getByRole('switch')).toHaveClass('extra-class')
  })

  test('uses provided id', () => {
    render(<Switch id="my-switch" />)
    expect(screen.getByRole('switch')).toHaveAttribute('id', 'my-switch')
  })

  test('has type button to prevent form submission', () => {
    render(<Switch />)
    expect(screen.getByRole('switch')).toHaveAttribute('type', 'button')
  })

  test('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<Switch ref={ref} />)
    expect(ref).toHaveBeenCalled()
  })
})
