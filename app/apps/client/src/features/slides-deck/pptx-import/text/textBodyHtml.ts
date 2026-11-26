import { mergeDefined } from './mergeDefined'
import { mergeParagraphStyle } from './mergeParagraphStyle'
import { readParagraphStyle } from './readParagraphStyle'
import { readRunStyle } from './readRunStyle'
import { type PptxBoxText, runHtml } from './runHtml'
import type { PptxBodyStyle, PptxParagraphStyle, PptxRunStyle } from './types'
import { colorCss } from '../theme/colorCss'
import type { PptxColorContext, PptxRgba } from '../theme/types'
import { xmlChild } from '../xml/xmlChild'
import { xmlChildren } from '../xml/xmlChildren'
import { xmlNumber } from '../xml/xmlNumber'

/** A text body as a deck text box: its HTML and the box's own font, size and colour. */
export interface PptxTextHtml {
  html: string
  /** Design pixels. */
  fontSize: number
  fontFamily?: string
  color?: string
}

interface TextBodyOptions {
  /** A level's style through the master, layout and shape. */
  levelStyle: (level: number) => PptxParagraphStyle
  /** The shape's theme text colour (`p:style fontRef`), over the list styles'. */
  fontColor?: PptxRgba
  body: PptxBodyStyle
  color: PptxColorContext
  /** Design pixels per point. */
  pointPx: number
}

interface Part {
  text: string
  style: PptxRunStyle
  lineBreak: boolean
}

const DEFAULT_SIZE_PT = 18
const LINE = 1.2
const round = (value: number) => Math.round(value * 1000) / 1000

/** A paragraph's runs (`a:r`, `a:fld`) and line breaks (`a:br`), each with its style. */
function partsOf(p: Element, base: PptxRunStyle, color: PptxColorContext) {
  return xmlChildren(p)
    .filter((child) => ['r', 'fld', 'br'].includes(child.localName))
    .map(
      (child): Part => ({
        text: xmlChild(child, 't')?.textContent ?? '',
        style: mergeDefined(base, readRunStyle(xmlChild(child, 'rPr'), color)),
        lineBreak: child.localName === 'br',
      }),
    )
}

function spacingEm(
  spacing: PptxParagraphStyle['spaceBefore'],
  box: PptxBoxText,
): number {
  if (!spacing) return 0
  return 'percent' in spacing
    ? spacing.percent * LINE
    : spacing.points / box.sizePt
}

/** A paragraph's block styles: alignment, line spacing, indent and spacing. */
function blockCss(
  style: PptxParagraphStyle,
  first: boolean,
  inList: boolean,
  box: PptxBoxText,
  options: TextBodyOptions,
): string {
  const css = [`text-align: ${style.align ?? 'left'}`]
  const reduction = options.body.lineSpacingReduction ?? 0
  const line = style.lineSpacing
  if (line && 'percent' in line && (line.percent !== 1 || reduction)) {
    css.push(`line-height: ${round(LINE * line.percent * (1 - reduction))}`)
  } else if (line && 'points' in line) {
    css.push(`line-height: ${round(line.points / box.sizePt)}em`)
  } else if (reduction) {
    css.push(`line-height: ${round(LINE * (1 - reduction))}`)
  }
  const margin =
    (style.marginLeft ?? 0) / 12_700 / box.sizePt - (inList ? LINE : 0)
  if (margin > 0.01) css.push(`margin-left: ${round(margin)}em`)
  const before = first ? 0 : spacingEm(style.spaceBefore, box)
  if (before > 0.01) css.push(`margin-top: ${round(before)}em`)
  const after = spacingEm(style.spaceAfter, box)
  if (after > 0.01) css.push(`margin-bottom: ${round(after)}em`)
  return css.join('; ')
}

/**
 * A shape's text body as a text box's HTML: each paragraph a `<p>`, or an
 * `<li>` of a `<ul>`/`<ol>` when it has a bullet or number (one block per
 * `a:p`, which a by-paragraph build animates), its runs styled
 * where they differ from the box (its first run's look); null when it holds
 * no text (an empty placeholder, which a show leaves out).
 */
export function textBodyHtml(
  txBody: Element,
  options: TextBodyOptions,
): PptxTextHtml | null {
  const { color } = options
  const paragraphs = xmlChildren(txBody, 'p').map((p) => {
    const pPr = xmlChild(p, 'pPr')
    const level = xmlNumber(pPr, 'lvl') ?? 0
    const style = mergeParagraphStyle(
      options.levelStyle(level),
      readParagraphStyle(pPr, color),
    )
    const runBase = mergeDefined(style.run, { color: options.fontColor })
    const parts = partsOf(p, runBase, color)
    const end = mergeDefined(
      runBase,
      readRunStyle(xmlChild(p, 'endParaRPr'), color),
    )
    return { style, parts, end }
  })
  const firstText = paragraphs
    .flatMap((p) => p.parts)
    .find((part) => part.text.trim())
  if (!firstText) return null

  const fallbackColor = color.theme.colors[color.colorMap.tx1 ?? 'dk1']
  const box: PptxBoxText = {
    sizePt: firstText.style.sizePt ?? DEFAULT_SIZE_PT,
    font: firstText.style.font,
    color: firstText.style.color
      ? colorCss(firstText.style.color)
      : fallbackColor && `#${fallbackColor.toLowerCase()}`,
  }

  let html = ''
  let openList: 'ul' | 'ol' | null = null
  paragraphs.forEach(({ style, parts, end }, index) => {
    const hasText = parts.some((part) => part.text)
    const list =
      hasText && style.bullet === 'char'
        ? 'ul'
        : hasText && style.bullet === 'number'
          ? 'ol'
          : null
    if (openList && list !== openList) {
      html += `</${openList}>`
      openList = null
    }
    if (list && !openList) {
      html += `<${list}>`
      openList = list
    }
    const tag = list ? 'li' : 'p'
    let css = blockCss(style, index === 0, !!list, box, options)
    let inner = parts
      .map((part) =>
        part.lineBreak ? '<br>' : runHtml(part.text, part.style, box),
      )
      .join('')
    if (!hasText) {
      const size = end.sizePt ?? box.sizePt
      if (Math.abs(size - box.sizePt) > 0.01) {
        css += `; font-size: ${round(size / box.sizePt)}em`
      }
      inner = '<br>'
    }
    html += `<${tag} style="${css}">${inner}</${tag}>`
  })
  if (openList) html += `</${openList}>`

  return {
    html,
    fontSize: round(box.sizePt * options.pointPx),
    fontFamily: box.font,
    color: box.color,
  }
}
