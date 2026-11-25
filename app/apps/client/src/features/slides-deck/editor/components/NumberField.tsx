import { PanelField } from './PanelField'

interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  testId?: string
}

/** A number typed in the editor's panel; an empty or bad entry is ignored. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  testId,
}: NumberFieldProps) {
  return (
    <PanelField label={label}>
      <input
        type="number"
        data-testid={testId}
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const next = e.target.valueAsNumber
          if (Number.isFinite(next)) onChange(next)
        }}
        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      />
    </PanelField>
  )
}
