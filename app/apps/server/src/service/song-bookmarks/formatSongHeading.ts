import { escapeMarkdown } from '../bookmark-markdown'

/**
 * A song's heading in the Marcaje Markdown: its title, then its id as a
 * standard heading attribute (`{#song-12}`, as Pandoc and kramdown read it),
 * so an import finds the exact song even when two share a title.
 */
export function formatSongHeading(title: string, songId: number): string {
  return `## ${escapeMarkdown(title.trim())} {#song-${songId}}`
}
