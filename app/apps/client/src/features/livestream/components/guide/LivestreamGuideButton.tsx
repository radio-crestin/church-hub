import { BookOpen } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { LivestreamGuideModal } from './LivestreamGuideModal'
import { Button } from '../../../../ui/button/Button'

/** Opens the livestream setup guide. */
export function LivestreamGuideButton({
  variant = 'outline',
}: {
  variant?: 'outline' | 'primary'
}) {
  const { t } = useTranslation('livestream')
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setIsOpen(true)}>
        <span className="inline-flex items-center gap-2">
          <BookOpen className="h-4 w-4" aria-hidden />
          {t('guide.open')}
        </span>
      </Button>
      <LivestreamGuideModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
