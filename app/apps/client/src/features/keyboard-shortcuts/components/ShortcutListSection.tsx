import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ShortcutRecorder } from './ShortcutRecorder'

interface ShortcutListSectionProps {
  title: string
  description: string
  shortcuts: string[]
  onChange: (shortcuts: string[]) => void
  getError: (
    shortcut: string,
    index: number,
    list: string[],
  ) => string | undefined
  /** Whether a MIDI button may be recorded (default true). */
  allowMidi?: boolean
  /** Test id of the section; recorders get `${testId}-recorder`. */
  testId?: string
}

/**
 * One titled list of shortcut recorders with an "add" button — the building
 * block every per-page shortcut group is made of.
 */
export function ShortcutListSection({
  title,
  description,
  shortcuts,
  onChange,
  getError,
  allowMidi = true,
  testId,
}: ShortcutListSectionProps) {
  const { t } = useTranslation('settings')

  return (
    <div className="space-y-2" data-testid={testId}>
      <div>
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
          {title}
        </h4>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>

      <div className="space-y-2">
        {shortcuts.map((shortcut, index) => {
          const error = getError(shortcut, index, shortcuts)
          return (
            <div key={index}>
              <ShortcutRecorder
                value={shortcut}
                onChange={(value) =>
                  onChange(shortcuts.map((s, i) => (i === index ? value : s)))
                }
                onRemove={() =>
                  onChange(shortcuts.filter((_, i) => i !== index))
                }
                error={error}
                namespace="settings"
                allowMidi={allowMidi}
              />
              {error && (
                <p className="mt-1 text-red-600 text-xs dark:text-red-400">
                  {error}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => onChange([...shortcuts, ''])}
        data-testid={testId ? `${testId}-add` : undefined}
        className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        <Plus size={16} />
        {t('sections.shortcuts.addShortcut')}
      </button>
    </div>
  )
}
