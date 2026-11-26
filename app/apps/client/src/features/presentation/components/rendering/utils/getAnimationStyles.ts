import type { AnimationType } from '../../../types'

/**
 * The CSS styles an animation starts from and ends at.
 */
export function getAnimationStyles(animType: AnimationType): {
  start: React.CSSProperties
  end: React.CSSProperties
} {
  switch (animType) {
    case 'fade':
      return { start: { opacity: 0 }, end: { opacity: 1 } }
    case 'slide-up':
      return {
        start: { opacity: 0, transform: 'translateY(30px)' },
        end: { opacity: 1, transform: 'translateY(0)' },
      }
    case 'slide-down':
      return {
        start: { opacity: 0, transform: 'translateY(-30px)' },
        end: { opacity: 1, transform: 'translateY(0)' },
      }
    case 'slide-left':
      return {
        start: { opacity: 0, transform: 'translateX(30px)' },
        end: { opacity: 1, transform: 'translateX(0)' },
      }
    case 'slide-right':
      return {
        start: { opacity: 0, transform: 'translateX(-30px)' },
        end: { opacity: 1, transform: 'translateX(0)' },
      }
    case 'zoom':
      return {
        start: { opacity: 0, transform: 'scale(0.85)' },
        end: { opacity: 1, transform: 'scale(1)' },
      }
    case 'blur':
      return {
        start: { opacity: 0, filter: 'blur(10px)' },
        end: { opacity: 1, filter: 'blur(0px)' },
      }
    case 'none':
    default:
      return { start: { opacity: 1 }, end: { opacity: 1 } }
  }
}
