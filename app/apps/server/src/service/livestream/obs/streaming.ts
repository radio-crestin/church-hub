import { obsConnection } from './websocket-client'

export async function startStreaming(): Promise<void> {
  await obsConnection.startStreaming()
}

export async function stopStreaming(): Promise<void> {
  await obsConnection.stopStreaming()
}

export function getStreamingStatus(): { isStreaming: boolean } {
  return obsConnection.getStreamingStatus()
}

export async function toggleStreaming(): Promise<void> {
  const { isStreaming } = getStreamingStatus()
  if (isStreaming) {
    await stopStreaming()
  } else {
    await startStreaming()
  }
}

export async function startRecording(): Promise<void> {
  await obsConnection.startRecording()
}

export async function stopRecording(): Promise<void> {
  await obsConnection.stopRecording()
}
