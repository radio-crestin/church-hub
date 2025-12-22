export const CONTENT_TYPES = [
  'song',
  'bible',
  'bible_passage',
  'announcement',
  'versete_tineri',
  'empty',
] as const

export type ContentType = (typeof CONTENT_TYPES)[number]
