import { CaseLower, CaseSensitive, CaseUpper, Type } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import type { TextTransform } from './transformSlideText'
import { useToolbarMenu } from './useToolbarMenu'

const TRANSFORMS: Array<{ id: TextTransform; icon: typeof Type }> = [
  { id: 'lower', icon: CaseLower },
  { id: 'upper', icon: CaseUpper },
  { id: 'sentence', icon: CaseSensitive },
  { id: 'lineStart', icon: Type },
]

interface TextTransformMenuProps {
  /** Re-cases the current selection. */
  onTransform: (transform: TextTransform) => void
  disabled?: boolean
}

/**
 * PowerPoint's "Change Case": re-cases what is selected without touching the
 * rest of the slide, and without disturbing the styling put on those words.
 */
export function TextTransformMenu({
  onTransform,
  disabled = false,
}: TextTransformMenuProps) {
  const { t } = useTranslation('songs')
  const { anchorRef, panelRef, at, close, toggle } = useToolbarMenu<
    HTMLButtonElement,
    HTMLUListElement
  >()

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        data-testid="slide-style-transform-menu"
        // Opening the menu must not take the selection it is about to re-case.
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggle}
        disabled={disabled}
        title={t('stageEditor.style.changeCase')}
        aria-label={t('stageEditor.style.changeCase')}
        className="flex items-center justify-center rounded-md border border-line p-1.5 text-fg-label transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CaseSensitive size={16} />
      </button>

      {at &&
        createPortal(
          <ul
            ref={panelRef}
            data-testid="slide-style-transform-list"
            className="fixed z-[100] w-56 rounded-[10px] border border-line bg-panel py-1 shadow-popover"
            style={{ top: at.top, left: at.left }}
          >
            {TRANSFORMS.map(({ id, icon: Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  data-testid={`slide-style-transform-${id}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    close()
                    onTransform(id)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg-body transition-colors hover:bg-hover"
                >
                  <Icon size={14} className="shrink-0 text-fg-hint" />
                  {t(`stageEditor.style.case.${id}`)}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  )
}
