import { FileText, Presentation } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type SongEditorMode = 'slides' | 'text'

interface SongEditorModeSwitchProps {
  mode: SongEditorMode
  onChange: (mode: SongEditorMode) => void
}

/** Slides (PowerPoint-style) or the whole song as text. */
export function SongEditorModeSwitch({
  mode,
  onChange,
}: SongEditorModeSwitchProps) {
  const { t } = useTranslation('songs')
  const options = [
    {
      id: 'slides' as const,
      label: t('songEditor.mode.slides'),
      Icon: Presentation,
    },
    { id: 'text' as const, label: t('songEditor.mode.text'), Icon: FileText },
  ]

  return (
    <div
      role="radiogroup"
      aria-label={t('songEditor.mode.label')}
      className="inline-flex rounded-lg bg-field p-0.5"
    >
      {options.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          onClick={() => onChange(id)}
          data-testid={`song-editor-mode-${id}`}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === id
              ? 'bg-panel text-fg shadow-sm'
              : 'text-fg-label hover:text-fg'
          }`}
        >
          <Icon size={15} />
          {label}
        </button>
      ))}
    </div>
  )
}
