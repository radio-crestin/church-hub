import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { Input } from '../input/Input'

describe('Input', () => {
  test('renders with placeholder', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  test('accepts user input', async () => {
    const user = userEvent.setup()
    render(<Input placeholder="Type here" />)

    const input = screen.getByPlaceholderText('Type here')
    await user.type(input, 'Hello World')

    expect(input).toHaveValue('Hello World')
  })

  test('calls onChange when value changes', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Input onChange={handleChange} placeholder="Input" />)

    await user.type(screen.getByPlaceholderText('Input'), 'test')

    expect(handleChange).toHaveBeenCalled()
  })

  test('is disabled when disabled prop is true', () => {
    render(<Input disabled placeholder="Disabled" />)
    expect(screen.getByPlaceholderText('Disabled')).toBeDisabled()
  })

  test('applies custom className', () => {
    render(<Input className="custom-class" placeholder="Custom" />)
    expect(screen.getByPlaceholderText('Custom')).toHaveClass('custom-class')
  })

  test('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<Input ref={ref} placeholder="Ref test" />)
    expect(ref).toHaveBeenCalled()
  })
})
