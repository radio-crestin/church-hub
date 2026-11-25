import { ClipboardPaste, Copy, Lock, LockOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button/Button'
import { useToast } from '~/ui/toast/useToast'
import { fitPositionToScreen } from './fitPositionToScreen'
import { usePositionClipboard } from './usePositionClipboard'
import type { Constraints, SizeWithUnits } from '../../../types'

interface PositionToolsProps {
  constraints: Constraints
  size: SizeWithUnits
  screenWidth: number
  screenHeight: number
  locked: boolean
  onPaste: (constraints: Constraints, size: SizeWithUnits) => void
  onLockedChange: (locked: boolean) => void
}

/**
 * Copy an element's place and size, paste it on another element (on any
 * slide type or screen), and lock it so it can't be moved by mistake.
 */
export function PositionTools({
  constraints,
  size,
  screenWidth,
  screenHeight,
  locked,
  onPaste,
  onLockedChange,
}: PositionToolsProps) {
  const { t } = useTranslation('presentation')
  const { showToast } = useToast()
  const { copied, copy } = usePositionClipboard()

  const handleCopy = () => {
    copy({ constraints, size, screenWidth, screenHeight })
    showToast(t('screens.position.copied'), 'success')
  }

  const handlePaste = () => {
    if (!copied) return
    const pasted = fitPositionToScreen(copied, screenWidth, screenHeight)
    onPaste(pasted.constraints, pasted.size)
  }

  const LockIcon = locked ? Lock : LockOpen

  return (
    <div
      className="flex flex-wrap gap-2"
      data-testid="screen-editor-position-tools"
    >
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        data-testid="screen-editor-copy-position"
      >
        <Copy size={16} strokeWidth={1.5} className="mr-1.5" />
        {t('screens.position.copy')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handlePaste}
        disabled={!copied || locked}
        title={copied ? undefined : t('screens.position.nothingCopied')}
        data-testid="screen-editor-paste-position"
      >
        <ClipboardPaste size={16} strokeWidth={1.5} className="mr-1.5" />
        {t('screens.position.paste')}
      </Button>
      <Button
        variant={locked ? 'primary' : 'outline'}
        size="sm"
        onClick={() => onLockedChange(!locked)}
        aria-pressed={locked}
        title={t(
          locked ? 'screens.position.unlockHint' : 'screens.position.lockHint',
        )}
        data-testid="screen-editor-lock-position"
      >
        <LockIcon className="w-4 h-4 mr-1.5" />
        {t(locked ? 'screens.position.locked' : 'screens.position.lock')}
      </Button>
    </div>
  )
}
