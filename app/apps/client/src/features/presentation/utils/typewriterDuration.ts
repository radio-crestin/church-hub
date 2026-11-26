/**
 * The typewriter's duration is the longest a slide's text may take to type;
 * a short text types faster than that at a calm pace (msPerCharacter).
 */
export const TYPEWRITER_DURATION = {
  default: 3500,
  min: 1000,
  max: 8000,
  step: 250,
} as const
