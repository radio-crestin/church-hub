import { createFileRoute } from '@tanstack/react-router'

import { UserList } from '~/features/users'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

export const Route = createFileRoute('/users/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <PagePermissionGuard permission="users.view">
      <div className="space-y-6 pb-6">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
          <UserList />
        </div>
      </div>
    </PagePermissionGuard>
  )
}
