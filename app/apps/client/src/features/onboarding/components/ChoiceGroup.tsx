interface ChoiceGroupProps<T extends string> {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

/** A row of buttons for one choice, the chosen one highlighted. */
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: ChoiceGroupProps<T>) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-gray-900 dark:text-white">
        {label}
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 aria-pressed:border-indigo-600 aria-pressed:bg-indigo-50 aria-pressed:text-indigo-700 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:aria-pressed:border-indigo-500 dark:aria-pressed:bg-indigo-950 dark:aria-pressed:text-indigo-300"
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
