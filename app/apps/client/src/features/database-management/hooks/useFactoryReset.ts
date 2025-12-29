import { useCallback, useState } from 'react'

import { fetcher } from '~/utils/fetcher'

interface FactoryResetResult {
  success: boolean
  message: string
  error?: string
}

interface ApiFactoryResetResponse {
  data?: FactoryResetResult
  error?: string
}

/**
 * Hook for performing a factory reset of application settings
 */
export function useFactoryReset() {
  const [isPending, setIsPending] = useState(false)

  const performFactoryReset = useCallback(async (): Promise<{
    success: boolean
    message?: string
    error?: string
  }> => {
    setIsPending(true)

    try {
      const response = await fetcher<ApiFactoryResetResponse>(
        '/api/database/factory-reset',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      )

      if (response.error) {
        return { success: false, error: response.error }
      }

      return {
        success: true,
        message: response.data?.message,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    } finally {
      setIsPending(false)
    }
  }, [])

  return { performFactoryReset, isPending }
}
