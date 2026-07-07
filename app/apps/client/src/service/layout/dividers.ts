/**
 * Keys for persisted resizable-divider positions.
 *
 * Each key doubles as the `localStorage` key under which the divider's position
 * (a percentage) is stored — see `useDividerPosition`. Positions are a personal,
 * per-device UI preference: they live only in this machine's localStorage and
 * are never synced through the database.
 */
export const DIVIDER_KEYS = {
  songDetailLeft: 'divider.song_detail_left',
  songDetailRight: 'divider.song_detail_right',
  songDetailAccordion: 'divider.song_detail_accordion',
  /** PowerPoint layout: Stage board (left) vs the Marcaje/Versiuni column. */
  songDetailPowerpoint: 'divider.song_detail_powerpoint',
  bibleLeft: 'divider.bible_left',
  bibleRight: 'divider.bible_right',
  music: 'divider.music',
  scheduleList: 'divider.schedule_list',
} as const

/**
 * Default positions (percentages) for the song-detail horizontal layout. These
 * are the single source of truth for where the Marcaje column begins, so the
 * songs-list page can mirror that exact edge (see `useMarcajeBoundary`).
 *
 *  - `left`  — Slides column width, as a % of the whole page.
 *  - `right` — Stage (Control Panel) width, as a % of the right-of-slides area.
 *
 * With the defaults the Marcaje column starts at
 * `left + (100 - left) * right / 100` = 30 + 70·0.57 ≈ 70% of the page.
 */
export const SONG_DETAIL_DEFAULTS = {
  left: 30,
  right: 57,
} as const
