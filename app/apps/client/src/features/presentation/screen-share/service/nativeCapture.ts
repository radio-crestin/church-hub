import { invoke } from '@tauri-apps/api/core'

import type { VideoElementConfig } from '../../types'

type ObjectFit = VideoElementConfig['objectFit']

/** A screen or window the desktop app can capture (Rust list_sources.rs). */
export interface CaptureSource {
  id: string
  kind: 'monitor' | 'window'
  name: string
  appName: string | null
  width: number
  height: number
  thumbnail: string | null
}

/** Emitted by Rust when the shared window or screen goes away. */
export const CAPTURE_ENDED_EVENT = 'screen-capture-ended'

export function listCaptureSources(): Promise<CaptureSource[]> {
  return invoke<CaptureSource[]>('screen_capture_sources')
}

export function startNativeCapture(
  sourceId: string,
  token: string,
  fps = 15,
): Promise<void> {
  return invoke('screen_capture_start', { sourceId, token, fps })
}

export function stopNativeCapture(): Promise<void> {
  return invoke('screen_capture_stop')
}

/** The share's area in this window's viewport, in CSS pixels. */
export interface SurfaceRect {
  x: number
  y: number
  width: number
  height: number
}

/** true when Rust draws the share with the GPU over `rect`. */
export function showGpuShareSurface(
  rect: SurfaceRect,
  objectFit: ObjectFit,
): Promise<boolean> {
  return invoke<boolean>('screen_share_surface_show', { rect, objectFit })
}

export function hideGpuShareSurface(): Promise<void> {
  return invoke('screen_share_surface_hide')
}
