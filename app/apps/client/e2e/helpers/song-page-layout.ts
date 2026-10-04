/**
 * An arrangement of the classic song page that keeps Marcaje, Programe and
 * Versiuni together in the third column, as the page's default once did.
 *
 * Specs about how that column behaves (scrolling, shutting rows, the divider
 * toggle) seed this instead of relying on the default, which now puts Versiuni
 * under the preview. The verses and the preview swap places on purpose: the
 * page's previous default is migrated away on load, so an arrangement equal to
 * it would be forgotten.
 */
export const SIDE_PANELS_TOGETHER_LAYOUT = {
  columns: [
    { id: 'col-1', panelIds: ['control'] },
    { id: 'col-2', panelIds: ['slides'] },
    { id: 'col-3', panelIds: ['bookmarks', 'schedules', 'versions'] },
  ],
}

export const SONG_PAGE_LAYOUT_KEY = 'workspace.song-detail.layout'
