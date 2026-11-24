import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isValidApiUrl, testApiConnection } from '~/service/api-url'

export type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error'

/**
 * Tests a server or pairing link before the phone saves it: the status and
 * the error to show, shared by the first-run setup, Settings > Connection and
 * the reconnect dialog.
 */
export function useConnectionTest() {
  const { t } = useTranslation('settings')
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  /** True when the server at `target` answered. */
  const test = async (target: string) => {
    if (!target.trim()) {
      setErrorMessage(t('sections.apiUrl.errors.emptyUrl'))
      return false
    }
    if (!isValidApiUrl(target)) {
      setErrorMessage(t('sections.apiUrl.errors.invalidUrl'))
      return false
    }

    setStatus('testing')
    setErrorMessage('')
    const result = await testApiConnection(target)
    if (result.success) {
      setStatus('success')
      return true
    }
    setStatus('error')
    setErrorMessage(
      result.error || t('sections.apiUrl.errors.connectionFailed'),
    )
    return false
  }

  const reset = () => {
    setStatus('idle')
    setErrorMessage('')
  }

  return {
    status,
    isLoading: status === 'testing',
    errorMessage,
    setErrorMessage,
    test,
    reset,
  }
}
