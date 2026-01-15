import type { ErrorComponentProps } from '@tanstack/react-router'
import {
  ErrorComponent,
  Link,
  rootRouteId,
  useMatch,
  useRouter,
} from '@tanstack/react-router'
import { useEffect } from 'react'

import { Sentry } from '~/sentry'

export default function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter()
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  })

  // Capture error to Sentry
  useEffect(() => {
    if (error) {
      Sentry.captureException(error, {
        tags: {
          boundary: 'DefaultCatchBoundary',
          route: router.state.location.pathname,
        },
      })
    }
  }, [error, router.state.location.pathname])

  return (
    <div className="min-w-0 flex-1 p-4 flex flex-col items-center justify-center gap-6">
      <ErrorComponent error={error} />
      <div className="flex gap-2 items-center flex-wrap">
        <button
          onClick={() => {
            router.invalidate()
          }}
          className={`px-2 py-1 bg-gray-600 dark:bg-gray-800 hover:bg-gray-700 dark:hover:bg-gray-700 rounded-sm text-white uppercase font-extrabold transition-colors`}
        >
          Try Again
        </button>
        {isRoot ? (
          <Link
            to="/present"
            className={`px-2 py-1 bg-gray-600 dark:bg-gray-800 hover:bg-gray-700 dark:hover:bg-gray-700 rounded-sm text-white uppercase font-extrabold transition-colors`}
          >
            Home
          </Link>
        ) : (
          <Link
            to="/present"
            className={`px-2 py-1 bg-gray-600 dark:bg-gray-800 hover:bg-gray-700 dark:hover:bg-gray-700 rounded-sm text-white uppercase font-extrabold transition-colors`}
            onClick={(e) => {
              e.preventDefault()
              window.history.back()
            }}
          >
            Go Back
          </Link>
        )}
      </div>
    </div>
  )
}
