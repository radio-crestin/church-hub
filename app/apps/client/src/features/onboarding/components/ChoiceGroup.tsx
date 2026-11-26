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
      <legend className="text-sm font-medium text-fg">{label}</legend>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className="rounded-lg bg-field px-3 py-2.5 text-sm font-medium text-fg-body transition-colors hover:bg-hover aria-pressed:bg-selected aria-pressed:text-fg"
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
