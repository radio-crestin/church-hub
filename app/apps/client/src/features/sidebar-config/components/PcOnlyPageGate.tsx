import { useLocation } from '@tanstack/react-router'
import { Monitor } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '~/ui/page'
import { isPcOnlyPathInWebApp } from '../utils/pcOnlyPages'

/**
 * The page, unless the web app was sent to one only the church PC serves
 * (a link or a shortcut): then a note that it needs the church computer.
 */
export function PcOnlyPageGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common')
  const { pathname } = useLocation()

  if (!isPcOnlyPathInWebApp(pathname)) return <>{children}</>

  return (
    <EmptyState
      icon={Monitor}
      title={t('errors.needsChurchPcTitle')}
      hint={t('errors.needsChurchPc')}
    />
  )
}
