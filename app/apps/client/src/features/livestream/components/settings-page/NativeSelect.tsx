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
      className="w-full rounded-[10px] bg-field px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
