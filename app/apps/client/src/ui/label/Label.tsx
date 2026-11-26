import { forwardRef } from 'react'

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  className?: string
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={`block text-sm font-medium text-fg-label ${className}`}
        {...props}
      >
        {children}
      </label>
    )
  },
)

Label.displayName = 'Label'
