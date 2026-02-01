import { useCallback, useRef, useState } from 'react'

import { generateBroadcastMessage } from '../service'

export function useBroadcastMessage() {
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  // Track which URL the current message was generated for
  const messageUrlRef = useRef<string | null>(null)

  const fetchMessage = useCallback(async (broadcastUrl?: string) => {
    setIsLoading(true)
    try {
      const result = await generateBroadcastMessage(broadcastUrl)
      setMessage(result)
      messageUrlRef.current = broadcastUrl || null
      return result
    } finally {
      setIsLoading(false)
    }
  }, [])

  const copyMessage = useCallback(
    async (broadcastUrl?: string) => {
      // Re-fetch if the URL changed since the last fetch
      let text = message
      if (!text || messageUrlRef.current !== (broadcastUrl || null)) {
        text = await fetchMessage(broadcastUrl)
      }
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      return text
    },
    [message, fetchMessage],
  )

  return {
    message,
    isLoading,
    fetchMessage,
    copyMessage,
    copied,
  }
}
