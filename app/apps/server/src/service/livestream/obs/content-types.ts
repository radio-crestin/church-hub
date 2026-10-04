export const CONTENT_TYPES = [
  'song_temporary',
  'song_schedule',
  'bible',
  'bible_passage',
  'announcement',
  'versete_tineri',
  'empty',
] as const

export type ContentType = (typeof CONTENT_TYPES)[number]

/**
 * What is live, as scene automation sees it: a content type a scene can be
 * mapped to, or a program "scene" item, which names its own OBS scene and so
 * is never mapped.
 */
export type LiveContentType = ContentType | 'scene'
