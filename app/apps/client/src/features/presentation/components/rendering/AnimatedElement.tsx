import { type ReactNode, useEffect, useState } from 'react'

import type { AnimationConfig } from '../../types'

interface AnimatedElementProps {
  children: ReactNode
  animationIn?: AnimationConfig
  animationOut?: AnimationConfig
  isVisible: boolean
  className?: string
  style?: React.CSSProperties
}

const EASING_FUNCTIONS: Record<string, string> = {
  linear: 'linear',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
}

export function AnimatedElement({
  children,
  animationIn,
  animationOut,
  isVisible,
  className = '',
  style = {},
}: AnimatedElementProps) {
  const [shouldRender, setShouldRender] = useState(isVisible)
  const [animationState, setAnimationState] = useState<'in' | 'out' | 'idle'>(
    'idle',
  )

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true)
      setAnimationState('in')
    } else if (shouldRender) {
      setAnimationState('out')
      const duration = animationOut?.duration || 300
      setTimeout(() => {
        setShouldRender(false)
        setAnimationState('idle')
      }, duration)
    }
  }, [isVisible, animationOut?.duration, shouldRender])

  if (!shouldRender) {
    return null
  }

  const currentAnimation = animationState === 'in' ? animationIn : animationOut
  const animationType = currentAnimation?.type || 'none'
  const duration = currentAnimation?.duration || 300
  const delay = currentAnimation?.delay || 0
  const easing = currentAnimation?.easing || 'easeOut'

  const getAnimationStyles = (): React.CSSProperties => {
    if (animationType === 'none' || animationState === 'idle') {
      return { opacity: isVisible ? 1 : 0 }
    }

    const easingFunc = EASING_FUNCTIONS[easing] || 'ease-out'
    const baseTransition = `all ${duration}ms ${easingFunc} ${delay}ms`

    const isEntering = animationState === 'in'
    const startStyles: React.CSSProperties = {}
    const endStyles: React.CSSProperties = {}

    switch (animationType) {
      case 'fade':
        startStyles.opacity = isEntering ? 0 : 1
        endStyles.opacity = isEntering ? 1 : 0
        break
      case 'slide-up':
        startStyles.transform = isEntering
          ? 'translateY(20px)'
          : 'translateY(0)'
        startStyles.opacity = isEntering ? 0 : 1
        endStyles.transform = isEntering ? 'translateY(0)' : 'translateY(-20px)'
        endStyles.opacity = isEntering ? 1 : 0
        break
      case 'slide-down':
        startStyles.transform = isEntering
          ? 'translateY(-20px)'
          : 'translateY(0)'
        startStyles.opacity = isEntering ? 0 : 1
        endStyles.transform = isEntering ? 'translateY(0)' : 'translateY(20px)'
        endStyles.opacity = isEntering ? 1 : 0
        break
      case 'slide-left':
        startStyles.transform = isEntering
          ? 'translateX(20px)'
          : 'translateX(0)'
        startStyles.opacity = isEntering ? 0 : 1
        endStyles.transform = isEntering ? 'translateX(0)' : 'translateX(-20px)'
        endStyles.opacity = isEntering ? 1 : 0
        break
      case 'slide-right':
        startStyles.transform = isEntering
          ? 'translateX(-20px)'
          : 'translateX(0)'
        startStyles.opacity = isEntering ? 0 : 1
        endStyles.transform = isEntering ? 'translateX(0)' : 'translateX(20px)'
        endStyles.opacity = isEntering ? 1 : 0
        break
      case 'zoom':
        startStyles.transform = isEntering ? 'scale(0.8)' : 'scale(1)'
        startStyles.opacity = isEntering ? 0 : 1
        endStyles.transform = isEntering ? 'scale(1)' : 'scale(0.8)'
        endStyles.opacity = isEntering ? 1 : 0
        break
      case 'blur':
        startStyles.filter = isEntering ? 'blur(10px)' : 'blur(0)'
        startStyles.opacity = isEntering ? 0 : 1
        endStyles.filter = isEntering ? 'blur(0)' : 'blur(10px)'
        endStyles.opacity = isEntering ? 1 : 0
        break
    }

    return {
      transition: baseTransition,
      ...endStyles,
    }
  }

  return (
    <div
      className={className}
      style={{
        ...style,
        ...getAnimationStyles(),
      }}
    >
      {children}
    </div>
  )
}
