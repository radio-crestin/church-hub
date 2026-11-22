interface NativeSelectProps<T extends string> {
  id: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  testId?: string
}

/** A short list to pick one value from, styled like the app's inputs. */
export function NativeSelect<T extends string>({
  id,
  value,
  options,
  onChange,
  testId,
}: NativeSelectProps<T>) {
  return (
    <select
      id={id}
      value={value}
      data-testid={testId}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
