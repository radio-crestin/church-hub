import { slowestTextAnimation } from './slowestTextAnimation'
import type { ShownContent } from '../../../hooks/useContentTypeHandoff'
import type {
  AnimationConfig,
  ContentType,
  ScreenBackgroundConfig,
  ScreenWithConfigs,
} from '../../../types'
import { resolveScreenBackground } from '../../../utils/resolveScreenBackground'
import type { ContentData } from '../types'

/** Two backgrounds are the same when every setting is. */
export function backgroundKey(background: ScreenBackgroundConfig | undefined) {
  return JSON.stringify(background ?? null)
}

export interface BackgroundTransition {
  /** The background to draw now */
  background: ScreenBackgroundConfig | undefined
  /** How a new background comes in: with the new text's entrance */
  enter: AnimationConfig
  /**
   * Set while the content leaving takes its background with it (the next one
   * differs): it fades out with the leaving text's exit. Null otherwise.
   */
  exit: AnimationConfig | null
}

/**
 * The background a screen draws and how it changes, in step with the text:
 * while a content type leaves (useContentTypeHandoff), its background stays,
 * and fades out with its text when the next content has another one; the new
 * background then fades in with the new text.
 */
export function backgroundTransition({
  screen,
  contentType,
  contentData,
  leaving,
}: {
  screen: ScreenWithConfigs
  contentType: ContentType
  contentData: ContentData
  leaving:
    | Pick<ShownContent<ContentData, unknown>, 'contentType' | 'contentData'>
    | null
    | undefined
}): BackgroundTransition {
  const next = resolveScreenBackground({ screen, contentType, contentData })
  const enter = slowestTextAnimation(
    screen.contentConfigs[contentType],
    'animationIn',
  )
  if (!leaving) return { background: next, enter, exit: null }

  const shown = resolveScreenBackground({
    screen,
    contentType: leaving.contentType,
    contentData: leaving.contentData,
  })
  const exit =
    backgroundKey(shown) === backgroundKey(next)
      ? null
      : slowestTextAnimation(
          screen.contentConfigs[leaving.contentType],
          'animationOut',
        )
  return { background: shown, enter, exit }
}
