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
 * Extracts filename without extension from a path or filename
 */
function extractFilenameWithoutExtension(filePath: string): string {
  // Get the filename from the path (handles both / and \ separators)
  const filename = filePath.split(/[/\\]/).pop() || filePath
  // Remove the extension
  return filename.replace(/\.[^.]+$/, '')
}

/**
 * Parses a PPTX file and extracts text from each slide
 * @param file - The PPTX file (File object or ArrayBuffer)
 * @param filename - Optional filename to use as title (for ArrayBuffer inputs)
 */
export async function parsePptxFile(
  file: File | ArrayBuffer,
  filename?: string,
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

  // Determine title from filename
  let title = 'Imported Song'
  if (filename) {
    title = extractFilenameWithoutExtension(filename)
  } else if (file instanceof File && file.name) {
    title = extractFilenameWithoutExtension(file.name)
  }

  return { title, slides }
}

/**
 * Extracts text content from a PPTX slide XML
 * Handles paragraphs (<a:p>) and line breaks (<a:br>) properly
 */
function extractTextFromSlideXml(xml: string): {
  text: string
  htmlContent: string
} {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')

  const NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'

  // Get all paragraph elements
  const paragraphs = doc.getElementsByTagNameNS(NS, 'p')
  const lines: string[] = []

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i]
    const paragraphLines = extractParagraphText(paragraph, NS)

    // Add non-empty lines
    for (const line of paragraphLines) {
      if (line.trim()) {
        lines.push(line.trim())
      }
    }
  }

  const text = lines.join('\n')
  const htmlContent = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')

  return { text, htmlContent }
}

/**
 * Extracts text from a paragraph element, respecting line breaks
 */
function extractParagraphText(paragraph: Element, ns: string): string[] {
  const result: string[] = []
  let currentLine = ''

  // Walk through child nodes to find text and line breaks
  const walker = document.createTreeWalker(
    paragraph,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    null,
  )

  let node: Node | null = walker.currentNode
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      // Check for line break element <a:br>
      if (element.localName === 'br' && element.namespaceURI === ns) {
        if (currentLine.trim()) {
          result.push(currentLine.trim())
        }
        currentLine = ''
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      // Check if parent is a text element <a:t>
      const parent = node.parentElement
      if (parent?.localName === 't' && parent.namespaceURI === ns) {
        currentLine += node.textContent || ''
      }
    }
    node = walker.nextNode()
  }

  // Add remaining text
  if (currentLine.trim()) {
    result.push(currentLine.trim())
  }

  return result
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
