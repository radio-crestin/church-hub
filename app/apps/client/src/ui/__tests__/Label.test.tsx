import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { Label } from '../label/Label'

describe('Label', () => {
  test('renders children correctly', () => {
    render(<Label>Username</Label>)
    expect(screen.getByText('Username')).toBeInTheDocument()
  })

  test('renders as a label element', () => {
    render(<Label>Email</Label>)
    const label = screen.getByText('Email')
    expect(label.tagName).toBe('LABEL')
  })

  test('applies default styling classes', () => {
    render(<Label>Name</Label>)
    const label = screen.getByText('Name')
    expect(label).toHaveClass('block', 'text-sm', 'font-medium')
  })

  test('applies custom className', () => {
    render(<Label className="extra-class">Name</Label>)
    expect(screen.getByText('Name')).toHaveClass('extra-class')
  })

  test('passes htmlFor attribute', () => {
    render(<Label htmlFor="email-input">Email</Label>)
    expect(screen.getByText('Email')).toHaveAttribute('for', 'email-input')
  })

  test('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<Label ref={ref}>Ref test</Label>)
    expect(ref).toHaveBeenCalled()
  })

  test('passes additional HTML label attributes', () => {
    render(<Label data-testid="my-label">Test</Label>)
    expect(screen.getByTestId('my-label')).toBeInTheDocument()
  })

  test('renders complex children', () => {
    render(
      <Label>
        <span>Required</span> field
      </Label>,
    )
    expect(screen.getByText('Required')).toBeInTheDocument()
  })
})
