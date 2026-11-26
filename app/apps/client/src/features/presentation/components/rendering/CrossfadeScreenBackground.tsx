import { useLayoutEffect, useRef, useState } from 'react'

import { ScreenBackground } from './ScreenBackground'
import type { ScreenBackgroundConfig } from '../../types'

/**
 * A background change dissolves over the slide's own handoff (its ~400 ms
 * fade out, then ~450 ms fade in), on a symmetric ease so neither background
 * snaps at either end.
 */
export const BACKGROUND_CROSSFADE = {
  duration: 800,
  easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
}

interface Layer {
  id: number
  key: string
  background: ScreenBackgroundConfig | undefined
  /** Dissolves in over the layer under it; the first background just shows */
  fadeIn: boolean
}

function backgroundKey(background: ScreenBackgroundConfig | undefined) {
  return JSON.stringify(background ?? null)
}

interface CrossfadeScreenBackgroundProps {
  background: ScreenBackgroundConfig | undefined
  playVideo?: boolean
}

/**
 * ScreenBackground that dissolves into a new background instead of cutting
 * to it (a song's own background, then the screen's for a verse): the old one
 * stays underneath until the new one is fully opaque over it. A change in the
 * middle of a dissolve dissolves over what is showing, without a jump.
 */
export function CrossfadeScreenBackground({
  background,
  playVideo,
}: CrossfadeScreenBackgroundProps) {
  const key = backgroundKey(background)
  const [layers, setLayers] = useState<Layer[]>([
    { id: 0, key, background, fadeIn: false },
  ])

  // Derived during render, so the new background never misses a frame.
  const top = layers[layers.length - 1]
  if (top.key !== key) {
    setLayers([...layers, { id: top.id + 1, key, background, fadeIn: true }])
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
    if (!layer.fadeIn || !ref.current) return
    const animation = ref.current.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      BACKGROUND_CROSSFADE,
    )
    animation.onfinish = () => onShownRef.current()
    return () => animation.cancel()
  }, [layer.fadeIn])

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
