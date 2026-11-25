import type { ErrorComponentProps } from '@tanstack/react-router'
import {
  ErrorComponent,
  Link,
  rootRouteId,
  useMatch,
  useRouter,
} from '@tanstack/react-router'
import { useEffect } from 'react'

import { captureError } from '~/utils/error-handler'

export default function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter()
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  })

  useEffect(() => {
    if (error) {
      // captureError fans out to PostHog + the console logger + the on-disk
      // server log (via /api/client-errors), so a route render crash is
      // recorded everywhere instead of PostHog-only.
      captureError(error, {
        source: 'react-router-boundary',
        component: 'DefaultCatchBoundary',
        route: router.state.location.pathname,
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
          className="inline-flex h-8 items-center px-3 bg-field hover:bg-hover rounded-lg text-[13px] font-medium text-fg transition-colors"
        >
          Try Again
        </button>
        {isRoot ? (
          <Link
            to="/present"
            className="inline-flex h-8 items-center px-3 bg-field hover:bg-hover rounded-lg text-[13px] font-medium text-fg transition-colors"
          >
            Home
          </Link>
        ) : (
          <Link
            to="/present"
            className="inline-flex h-8 items-center px-3 bg-field hover:bg-hover rounded-lg text-[13px] font-medium text-fg transition-colors"
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
