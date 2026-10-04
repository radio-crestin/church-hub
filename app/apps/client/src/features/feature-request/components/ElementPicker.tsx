import { Crosshair, Maximize } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PickerHighlight } from './PickerHighlight'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { findPickableElement } from '../utils/findPickableElement'
import { FEATURE_REQUEST_UI_ATTRIBUTE } from '../utils/isFeatureRequestUi'

interface ElementPickerProps {
  onPick: (element: Element | null) => void
  onCancel: () => void
}

/**
 * Screenshot-tool style picker. A transparent layer covers the whole app,
 * so nothing underneath reacts; hovering outlines the element below the
 * pointer and a click (or tap) picks it.
 */
export function ElementPicker({ onPick, onCancel }: ElementPickerProps) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState<Element | null>(null)
  useEscapeKey(onCancel)

  const handlePointerMove = (event: React.PointerEvent) => {
    setHovered(findPickableElement(event.clientX, event.clientY))
  }

  const handleClick = (event: React.MouseEvent) => {
    const element = findPickableElement(event.clientX, event.clientY)
    if (element) onPick(element)
  }

  const stopPicking = (event: React.SyntheticEvent) => event.stopPropagation()

  return (
    <div
      {...{ [FEATURE_REQUEST_UI_ATTRIBUTE]: '' }}
      data-testid="feature-request-picker"
      className="fixed inset-0 cursor-crosshair"
      style={{ zIndex: 2147483000 }}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
    >
      {hovered && <PickerHighlight element={hovered} />}

      <div
        className="fixed left-1/2 -translate-x-1/2 bottom-4 md:bottom-auto md:top-4 w-[calc(100%-2rem)] max-w-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl bg-gray-900/95 text-white shadow-2xl p-3 cursor-default"
        onClick={stopPicking}
        onPointerMove={stopPicking}
      >
        <p className="flex items-center gap-2 text-sm flex-1">
          <Crosshair size={18} className="flex-shrink-0 text-indigo-300" />
          {t('common:featureRequest.pickerHint')}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            data-testid="feature-request-whole-screen"
            onClick={() => onPick(null)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors"
          >
            <Maximize size={16} />
            {t('common:featureRequest.pickerWholeScreen')}
          </button>
          <button
            type="button"
            data-testid="feature-request-picker-cancel"
            onClick={onCancel}
            className="flex-1 sm:flex-none px-3 py-2 text-sm font-medium rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            {t('common:buttons.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
