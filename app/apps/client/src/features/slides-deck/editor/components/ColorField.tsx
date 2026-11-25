import { PanelField } from './PanelField'

/** `#rgb` or a colour name made `#rrggbb` for the colour input; others black. */
function toHex(color: string | undefined): string {
  if (!color) return '#000000'
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${[...color.slice(1)].map((c) => c + c).join('')}`
  }
  return '#000000'
}

interface ColorFieldProps {
  label: string
  value: string | undefined
  onChange: (color: string) => void
  testId?: string
}

/** A colour picked in the editor's panel. */
export function ColorField({
  label,
  value,
  onChange,
  testId,
}: ColorFieldProps) {
  return (
    <PanelField label={label}>
      <input
        type="color"
        data-testid={testId}
        value={toHex(value)}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full cursor-pointer rounded-md border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
      />
    </PanelField>
  )
}
