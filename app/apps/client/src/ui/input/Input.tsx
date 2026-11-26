import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full h-9 px-3 text-[13px] bg-field border-0 rounded-[10px] text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
        {...props}
      />
    )
  },
)

Input.displayName = 'Input'
