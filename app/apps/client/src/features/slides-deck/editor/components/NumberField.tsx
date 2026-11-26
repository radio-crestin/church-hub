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
        className="h-8 w-full rounded-[10px] border-0 bg-field px-2 text-[13px] text-fg focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus tabular-nums"
      />
    </PanelField>
  )
}
