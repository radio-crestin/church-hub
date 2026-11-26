import { PanelField } from './PanelField'

/** `#rgb` or `rgb()` made `#rrggbb` for the colour input; others black. */
function toHex(color: string | undefined): string {
  if (!color) return '#000000'
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  const rgb = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (rgb) {
    return `#${rgb
      .slice(1, 4)
      .map((c) => Number(c).toString(16).padStart(2, '0'))
      .join('')}`
  }
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
        className="h-8 w-full cursor-pointer rounded-[10px] border-0 bg-field p-1 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
      />
    </PanelField>
  )
}
