export const CONTENT_TYPES = [
  { value: 'song_temporary', labelKey: 'scenes.contentTypes.songTemporary' },
  { value: 'song_schedule', labelKey: 'scenes.contentTypes.songSchedule' },
  { value: 'bible', labelKey: 'scenes.contentTypes.bible' },
  { value: 'bible_passage', labelKey: 'scenes.contentTypes.biblePassage' },
  { value: 'announcement', labelKey: 'scenes.contentTypes.announcement' },
  { value: 'versete_tineri', labelKey: 'scenes.contentTypes.verseteTineri' },
  { value: 'empty', labelKey: 'scenes.contentTypes.empty' },
] as const

export type ContentType = (typeof CONTENT_TYPES)[number]['value']
