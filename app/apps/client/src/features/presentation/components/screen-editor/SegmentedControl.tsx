interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[]
  value: T | undefined
  onChange: (value: T) => void
}

/** A row of buttons choosing one value (alignment, clock format, …). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex gap-2 mt-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={`flex-1 min-w-0 h-8 text-[13px] font-medium rounded-lg transition-colors ${
            value === option.value
              ? 'bg-selected text-fg'
              : 'bg-field text-fg-label hover:bg-hover hover:text-fg'
          }`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
