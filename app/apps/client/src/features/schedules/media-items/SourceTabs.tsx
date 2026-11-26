interface SourceTabsProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  testId: string
}

/** Where an item takes its content from: one of a few tabs. */
export function SourceTabs<T extends string>({
  value,
  options,
  onChange,
  testId,
}: SourceTabsProps<T>) {
  return (
    <div
      role="radiogroup"
      data-testid={testId}
      className="flex rounded-lg bg-field p-1 gap-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            option.value === value
              ? 'bg-selected text-fg'
              : 'text-fg-label hover:text-fg'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
