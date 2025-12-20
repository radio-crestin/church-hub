import { useMutation } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

import { generateBroadcastMessage } from '../service'

export function useBroadcastMessage() {
  const [copied, setCopied] = useState(false)

  const mutation = useMutation({
    mutationFn: (broadcastUrl?: string) =>
      generateBroadcastMessage(broadcastUrl),
  })

  const copyMessage = useCallback(
    async (broadcastUrl?: string) => {
      const message = await mutation.mutateAsync(broadcastUrl)
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      return message
    },
    [mutation],
  )

  return {
    message: mutation.data,
    isLoading: mutation.isPending,
    copyMessage,
    copied,
  }
}
