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
      className="flex rounded-lg bg-gray-100 dark:bg-gray-900 p-1 gap-1"
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
              ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
