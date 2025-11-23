import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { fetcher } from '~/utils/fetcher'

export const Route = createFileRoute('/(root)/')({
  component: App,
})

function App() {
  const { data } = useQuery({
    queryKey: ['/'],
    queryFn: () => fetcher('/'),
  })

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <img src="/logo192.png" alt="Church Hub" className="w-16 h-16 flex-shrink-0" />
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Welcome to Church Hub
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage your church community with ease
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Server Status
        </h2>
        <pre className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 p-4 rounded border border-gray-200 dark:border-gray-800 overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  )
}
