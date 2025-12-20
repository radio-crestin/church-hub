import { obsConnection } from './websocket-client'

export async function startStreaming(): Promise<void> {
  await obsConnection.startStreaming()
}

export async function stopStreaming(): Promise<void> {
  await obsConnection.stopStreaming()
}

export async function startRecording(): Promise<void> {
  await obsConnection.startRecording()
}

export async function stopRecording(): Promise<void> {
  await obsConnection.stopRecording()
}
