/**
 * An arrangement of the classic song page that keeps Marcaje, Programe and
 * Versiuni together in the third column, as the page's default once did.
 *
 * Specs about how that column behaves (scrolling, shutting rows, the divider
 * toggle) seed this instead of relying on the default, which now puts Versiuni
 * under the preview. The verses and the preview swap places on purpose: the
 * page's previous default is migrated away on load, so an arrangement equal to
 * it would be forgotten. Pe aceeași temă stays under the verses, out of the
 * column these specs measure.
 */
export const SIDE_PANELS_TOGETHER_LAYOUT = {
  columns: [
    { id: 'col-1', panelIds: ['control'] },
    { id: 'col-2', panelIds: ['slides', 'same-theme'] },
    { id: 'col-3', panelIds: ['bookmarks', 'schedules', 'versions'] },
  ],
}

export const SONG_PAGE_LAYOUT_KEY = 'workspace.song-detail.layout'

/**
 * The PowerPoint song page as it comes by default, but with Pe aceeași temă
 * under the stage: Marcaje, Programe and Versiuni alone in the side column.
 */
export const POWERPOINT_SIDE_PANELS_LAYOUT = {
  columns: [
    { id: 'col-1', panelIds: ['stage', 'same-theme'] },
    { id: 'col-2', panelIds: ['bookmarks', 'schedules', 'versions'] },
  ],
}

export const POWERPOINT_PAGE_LAYOUT_KEY =
  'workspace.song-detail-powerpoint.layout'
