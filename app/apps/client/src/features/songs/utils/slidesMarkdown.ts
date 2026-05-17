export interface MarkdownSlide {
  id: string | number
  content: string
  sortOrder: number
  label?: string | null
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&amp;/g, '&')
}

export function htmlToMarkdown(html: string): string {
  let text = html

  text = text.replace(/<(strong|b)>(.*?)<\/\1>/gi, '**$2**')
  text = text.replace(/<(em|i)>(.*?)<\/\1>/gi, '*$2*')
  text = text.replace(/<u>(.*?)<\/u>/gi, '__$1__')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>\s*<p>/gi, '\n')
  text = text.replace(/<\/?p>/gi, '')

  return decodeHtmlEntities(text).trim()
}

export function markdownToHtml(markdown: string): string {
  let html = markdown
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__(.+?)__/g, '<u>$1</u>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  return html
}

export function slidesToMarkdown(slides: Array<{ content: string }>): string {
  return slides.map((s) => htmlToMarkdown(s.content)).join('\n\n---\n\n')
}

export function markdownToSlides(text: string): MarkdownSlide[] {
  if (!text.trim()) return []

  const normalized = text.replace(/\n\s*---\s*\n/g, '\n\n')
  const slideTexts = normalized
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const result: MarkdownSlide[] = []
  for (const slideText of slideTexts) {
    const lines = slideText.split('\n').filter((line) => line.trim().length > 0)
    if (lines.length === 0) continue

    const htmlContent = lines
      .map((line) => `<p>${markdownToHtml(line)}</p>`)
      .join('')

    result.push({
      id: `temp-${Date.now()}-${result.length}`,
      content: htmlContent || '<p></p>',
      sortOrder: result.length,
    })
  }
  return result
}
