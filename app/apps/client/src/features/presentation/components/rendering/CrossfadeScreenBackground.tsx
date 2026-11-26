import { useLayoutEffect, useRef, useState } from 'react'

import { ScreenBackground } from './ScreenBackground'
import type { AnimationConfig, ScreenBackgroundConfig } from '../../types'

interface Layer {
  id: number
  key: string
  background: ScreenBackgroundConfig | undefined
  /** How it comes in over the layer under it; null: the first, shown as is */
  enter: AnimationConfig | null
}

function backgroundKey(background: ScreenBackgroundConfig | undefined) {
  return JSON.stringify(background ?? null)
}

interface CrossfadeScreenBackgroundProps {
  background: ScreenBackgroundConfig | undefined
  /**
   * The entrance of the text the new background comes with (see
   * textEnterAnimation), so both arrive together; a cut cuts the background.
   */
  enter: AnimationConfig
  playVideo?: boolean
}

/**
 * ScreenBackground that dissolves into a new background instead of cutting
 * to it (a song's own background, then the screen's for a verse), in step
 * with the new text: the old one stays underneath until the new one is fully
 * opaque over it. A change in the middle of a dissolve dissolves over what is
 * showing, without a jump.
 */
export function CrossfadeScreenBackground({
  background,
  enter,
  playVideo,
}: CrossfadeScreenBackgroundProps) {
  const key = backgroundKey(background)
  const [layers, setLayers] = useState<Layer[]>([
    { id: 0, key, background, enter: null },
  ])

  // Derived during render, so the new background never misses a frame.
  const top = layers[layers.length - 1]
  if (top.key !== key) {
    setLayers([...layers, { id: top.id + 1, key, background, enter }])
  }

  // Once a layer is fully opaque, the ones under it are hidden: drop them.
  const dropLayersUnder = (id: number) =>
    setLayers((current) => current.filter((layer) => layer.id >= id))

  return layers.map((layer) => (
    <BackgroundLayer
      key={layer.id}
      layer={layer}
      covered={layer !== layers[layers.length - 1]}
      playVideo={playVideo}
      onShown={() => dropLayersUnder(layer.id)}
    />
  ))
}

function BackgroundLayer({
  layer,
  covered,
  playVideo,
  onShown,
}: {
  layer: Layer
  /** A newer background is dissolving in over this one */
  covered: boolean
  playVideo?: boolean
  onShown: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onShownRef = useRef(onShown)
  onShownRef.current = onShown

  useLayoutEffect(() => {
    const element = ref.current
    if (!layer.enter || !element) return
    const { type, duration, delay, easing } = layer.enter
    if (type === 'none' || duration <= 0) {
      onShownRef.current()
      return
    }
    // Held hidden for the two frames the text waits before its own entrance
    // starts (useSlideAnimation), so both begin on the same frame.
    element.style.opacity = '0'
    let animation: Animation | undefined
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        element.style.opacity = ''
        animation = element.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration,
          delay,
          easing,
          fill: 'backwards',
        })
        animation.onfinish = () => onShownRef.current()
      })
    })
    return () => {
      cancelAnimationFrame(frame)
      animation?.cancel()
    }
  }, [layer.enter])

  return (
    <div
      ref={ref}
      data-testid="screen-background-layer"
      className="absolute inset-0 pointer-events-none"
    >
      <ScreenBackground
        background={layer.background}
        playVideo={playVideo}
        testId={covered ? 'screen-background-under' : undefined}
      />
    </div>
  )
}
