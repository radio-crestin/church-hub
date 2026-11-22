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
          className={`flex-1 min-w-0 py-1.5 text-xs font-medium rounded ${
            value === option.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
