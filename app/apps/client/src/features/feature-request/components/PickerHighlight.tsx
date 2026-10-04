import { getElementLabel } from '../utils/getElementLabel'

interface PickerHighlightProps {
  element: Element
}

/** Outline plus a small name tag over the element under the pointer. */
export function PickerHighlight({ element }: PickerHighlightProps) {
  const rect = element.getBoundingClientRect()
  const tagAbove = rect.top > 28

  return (
    <div
      data-testid="feature-request-highlight"
      className="fixed pointer-events-none rounded-sm border-2 border-indigo-500 bg-indigo-500/15 transition-all duration-75"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }}
    >
      <span
        className={`absolute left-0 max-w-[16rem] truncate rounded bg-indigo-600 px-1.5 py-0.5 text-xs font-medium text-white ${tagAbove ? '-top-6' : 'top-full mt-1'}`}
      >
        {getElementLabel(element)}
      </span>
    </div>
  )
}
