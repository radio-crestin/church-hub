import JSZip from 'jszip'

export interface ParsedSlide {
  slideNumber: number
  text: string
  htmlContent: string
}

export interface ParsedPptx {
  title: string
  slides: ParsedSlide[]
}

/**
 * Parses a PPTX file and extracts text from each slide
 */
export async function parsePptxFile(
  file: File | ArrayBuffer,
): Promise<ParsedPptx> {
  const zip = await JSZip.loadAsync(file)
  const slides: ParsedSlide[] = []

  // Get all slide XML files (ppt/slides/slide1.xml, slide2.xml, etc.)
  const slideFiles = Object.keys(zip.files)
    .filter((name) => name.match(/ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const numA = Number.parseInt(a.match(/slide(\d+)/)?.[1] || '0')
      const numB = Number.parseInt(b.match(/slide(\d+)/)?.[1] || '0')
      return numA - numB
    })

  for (const slidePath of slideFiles) {
    const slideXml = await zip.file(slidePath)?.async('string')
    if (slideXml) {
      const slideNumber = Number.parseInt(
        slidePath.match(/slide(\d+)/)?.[1] || '0',
      )
      const { text, htmlContent } = extractTextFromSlideXml(slideXml)
      if (text.trim()) {
        slides.push({ slideNumber, text, htmlContent })
      }
    }
  }

  // Use first slide text or filename as title
  const firstLine = slides[0]?.text.split('\n')[0]?.trim()
  const title = firstLine?.substring(0, 100) || 'Imported Song'

  return { title, slides }
}

/**
 * Extracts text content from a PPTX slide XML
 */
function extractTextFromSlideXml(xml: string): {
  text: string
  htmlContent: string
} {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')

  // Extract text from <a:t> elements (PowerPoint text nodes)
  const textNodes = doc.getElementsByTagNameNS(
    'http://schemas.openxmlformats.org/drawingml/2006/main',
    't',
  )

  const lines: string[] = []
  let currentParagraph = ''
  let lastParent: Element | null = null

  for (let i = 0; i < textNodes.length; i++) {
    const textNode = textNodes[i]
    const text = textNode.textContent?.trim()

    if (text) {
      // Check if this is a new paragraph (different parent <a:p>)
      const paragraph = findParentParagraph(textNode)

      if (paragraph !== lastParent && currentParagraph) {
        lines.push(currentParagraph)
        currentParagraph = ''
      }

      currentParagraph += (currentParagraph ? ' ' : '') + text
      lastParent = paragraph
    }
  }

  // Don't forget the last paragraph
  if (currentParagraph) {
    lines.push(currentParagraph)
  }

  const text = lines.join('\n')
  const htmlContent = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')

  return { text, htmlContent }
}

/**
 * Finds the parent <a:p> paragraph element
 */
function findParentParagraph(element: Element): Element | null {
  let current: Element | null = element
  while (current) {
    if (current.localName === 'p') {
      return current
    }
    current = current.parentElement
  }
  return null
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
