import type { SelectedElement } from './hooks/useEditorState'
import type {
  AnimationConfig,
  ClockElementConfig,
  Constraints,
  ContentTypeConfig,
  ScreenWithConfigs,
  SizeWithUnits,
  TextStyle,
} from '../../types'

/** The fields the screen editor edits, across every kind of element. */
export interface ElementConfig {
  constraints?: Constraints
  size?: SizeWithUnits
  hidden?: boolean
  locked?: boolean
  style?: TextStyle
  labelStyle?: TextStyle
  contentStyle?: TextStyle
  animationIn?: AnimationConfig
  animationOut?: AnimationConfig
  slideTransitionIn?: AnimationConfig
  slideTransitionOut?: AnimationConfig
  /** The clock's own */
  format?: ClockElementConfig['format']
  showSeconds?: boolean
  /** The "Amin" element's saved text */
  text?: string
}

/**
 * The saved config of an element of the screen editor: the clock and the
 * next-slide box live on the screen, every other element in the slide type's
 * config. Undefined when the slide type has no such element.
 */
export function getElementConfig(
  screen: ScreenWithConfigs,
  config: ContentTypeConfig,
  type: NonNullable<SelectedElement>['type'],
): ElementConfig | undefined {
  if (type === 'clock') return screen.globalSettings.clockConfig
  if (type === 'nextSlide') return screen.nextSlideConfig
  return (config as unknown as Record<string, ElementConfig | undefined>)[type]
}
