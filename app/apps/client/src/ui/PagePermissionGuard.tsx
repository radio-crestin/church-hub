import { ShieldX, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { Permission } from '../features/users/types'
import { usePermissions } from '../provider/permissions-provider'

interface PagePermissionGuardProps {
  permission: Permission
  children: ReactNode
}

function ConnectionLostPage() {
  const { t } = useTranslation('common')
  const { refresh } = usePermissions()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <WifiOff className="w-16 h-16 text-gray-400 dark:text-gray-600 mb-4" />
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        {t('errors.connectionLostTitle')}
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md">
        {t('errors.connectionLost')}
      </p>
      <button
        onClick={() => refresh()}
        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
      >
        {t('buttons.retry')}
      </button>
    </div>
  )
}

function NoPermissionPage() {
  const { t } = useTranslation('common')
  const { refresh } = usePermissions()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <ShieldX className="w-16 h-16 text-gray-400 dark:text-gray-600 mb-4" />
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        {t('errors.noPermissionTitle')}
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md">
        {t('errors.noPermission')}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
        {t('errors.contactAdmin')}
      </p>
      <button
        onClick={() => refresh()}
        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
      >
        {t('buttons.retry')}
      </button>
    </div>
  )
}

export function PagePermissionGuard({
  permission,
  children,
}: PagePermissionGuardProps) {
  const { hasPermission, isLoading, isConnectionError } = usePermissions()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (isConnectionError) {
    return <ConnectionLostPage />
  }

  if (!hasPermission(permission)) {
    return <NoPermissionPage />
  }

  return <>{children}</>
}
