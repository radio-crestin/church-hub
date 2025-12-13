import { ShieldX } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { Permission } from '../features/users/types'
import { usePermissions } from '../provider/permissions-provider'

interface PagePermissionGuardProps {
  permission: Permission
  children: ReactNode
}

function NoPermissionPage() {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <ShieldX className="w-16 h-16 text-gray-400 dark:text-gray-600 mb-4" />
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        {t('errors.noPermissionTitle')}
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md">
        {t('errors.noPermission')}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-500">
        {t('errors.contactAdmin')}
      </p>
    </div>
  )
}

export function PagePermissionGuard({
  permission,
  children,
}: PagePermissionGuardProps) {
  const { hasPermission, isLoading } = usePermissions()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (!hasPermission(permission)) {
    return <NoPermissionPage />
  }

  return <>{children}</>
}
