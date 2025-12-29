import { fetcher } from '~/utils/fetcher'

interface FeedbackRequest {
  message: string
  osVersion: string
  appVersion: string
}

interface FeedbackResponse {
  success: boolean
  issueUrl?: string
  issueNumber?: number
  error?: string
}

export async function submitFeedback(
  data: FeedbackRequest,
): Promise<FeedbackResponse> {
  return await fetcher<FeedbackResponse>('/api/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
}

export async function getSystemInfo(): Promise<{
  osVersion: string
  appVersion: string
}> {
  let osVersion = 'Unknown'
  let appVersion = 'Unknown'

  if (isTauri) {
    try {
      const { getVersion } = await import('@tauri-apps/api/app')
      appVersion = await getVersion()
    } catch {
      appVersion = 'Unknown'
    }

    try {
      const { type, version, arch } = await import('@tauri-apps/plugin-os')
      const osType = type()
      const osVer = version()
      const osArch = arch()
      osVersion = `${osType} ${osVer} (${osArch})`
    } catch {
      osVersion = navigator.userAgent
    }
  } else {
    osVersion = navigator.userAgent
    appVersion = 'Web'
  }

  return { osVersion, appVersion }
}
