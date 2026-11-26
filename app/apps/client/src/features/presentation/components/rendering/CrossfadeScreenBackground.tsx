import { useLayoutEffect, useRef, useState } from 'react'

import { ScreenBackground } from './ScreenBackground'
import {
  type BackgroundTransition,
  backgroundKey,
} from './utils/backgroundTransition'
import type { AnimationConfig, ScreenBackgroundConfig } from '../../types'

interface Layer {
  id: number
  key: string
  background: ScreenBackgroundConfig | undefined
  /** How it comes in over the layer under it; null: the first, shown as is */
  enter: AnimationConfig | null
  /** Set once it fades out with the text leaving; it stays out */
  exit: AnimationConfig | null
}

interface CrossfadeScreenBackgroundProps extends BackgroundTransition {
  playVideo?: boolean
}

/**
 * ScreenBackground that changes in step with the text (backgroundTransition)
 * instead of cutting: a background leaving with its content fades out with
 * that content's text, and the next one fades in with the new text. A new
 * background that comes without an exit (a slide change of the same kind)
 * dissolves over the old one, which stays underneath until it is covered.
 */
export function CrossfadeScreenBackground({
  background,
  enter,
  exit,
  playVideo,
}: CrossfadeScreenBackgroundProps) {
  const key = backgroundKey(background)
  const [layers, setLayers] = useState<Layer[]>([
    { id: 0, key, background, enter: null, exit: null },
  ])

  // Derived during render, so the background never misses a frame.
  const top = layers[layers.length - 1]
  if (top.key !== key) {
    setLayers([
      ...layers,
      { id: top.id + 1, key, background, enter, exit: null },
    ])
  } else if (!top.exit !== !exit) {
    setLayers([...layers.slice(0, -1), { ...top, exit }])
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

function isCut(animation: AnimationConfig) {
  return animation.type === 'none' || animation.duration <= 0
}

function BackgroundLayer({
  layer,
  covered,
  playVideo,
  onShown,
}: {
  layer: Layer
  /** A newer background is coming in over this one */
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
    if (isCut(layer.enter)) {
      onShownRef.current()
      return
    }
    const { duration, delay, easing } = layer.enter
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

  useLayoutEffect(() => {
    const element = ref.current
    if (!layer.exit || !element) return
    if (isCut(layer.exit)) {
      element.style.visibility = 'hidden'
      return () => {
        element.style.visibility = ''
      }
    }
    const { duration, delay, easing } = layer.exit
    const animation = element.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration,
      delay,
      easing,
      fill: 'forwards',
    })
    return () => animation.cancel()
  }, [layer.exit])

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
