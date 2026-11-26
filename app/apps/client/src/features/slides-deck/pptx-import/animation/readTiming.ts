import type { PptxTimedEffect, PptxTiming } from './types'
import type { DeckTrigger } from '../../types'
import { xmlChild } from '../xml/xmlChild'
import { xmlChildren } from '../xml/xmlChildren'
import { xmlDescendants } from '../xml/xmlDescendants'
import { xmlNumber } from '../xml/xmlNumber'

/** A time node's start delay (`p:stCondLst/p:cond delay`), 0 when indefinite. */
function delayOf(cTn: Element): number {
  const cond = xmlChildren(xmlChild(cTn, 'stCondLst'), 'cond').find(
    (c) => c.getAttribute('delay') !== 'indefinite',
  )
  return Math.max(0, xmlNumber(cond, 'delay') ?? 0)
}

/** How long an effect runs: its longest behaviour, with that one's delay. */
function durationOf(effect: Element): number {
  let longest = xmlNumber(effect, 'dur') ?? 0
  for (const node of xmlDescendants(effect, 'cTn')) {
    longest = Math.max(longest, delayOf(node) + (xmlNumber(node, 'dur') ?? 0))
  }
  return longest
}

const TRIGGERS: Record<string, DeckTrigger> = {
  clickEffect: 'click',
  withEffect: 'with_previous',
  afterEffect: 'after_previous',
}

/** The effects of one top-level `p:par` of the main sequence: one click's. */
function readClickGroup(
  par: Element,
  clickGroup: number,
  automatic: boolean,
): PptxTimedEffect[] {
  const effects = xmlDescendants(par, 'cTn').filter(
    (cTn) =>
      cTn.hasAttribute('presetClass') &&
      xmlDescendants(cTn, 'spTgt')[0]?.getAttribute('spid'),
  )
  return effects.map((cTn, index): PptxTimedEffect => {
    const target = xmlDescendants(cTn, 'spTgt')[0] as Element
    const spid = target.getAttribute('spid') as string
    const range = xmlChild(target, 'txEl', 'pRg')
    const nodeType = cTn.getAttribute('nodeType') ?? ''
    const trigger =
      index === 0
        ? automatic
          ? nodeType === 'afterEffect'
            ? 'after_previous'
            : 'with_previous'
          : 'click'
        : (TRIGGERS[nodeType] ?? 'with_previous')
    return {
      spid,
      paragraphIndex: xmlNumber(range, 'st'),
      background: xmlChild(target, 'bg') !== null,
      presetClass: cTn.getAttribute('presetClass') ?? '',
      presetId: xmlNumber(cTn, 'presetID') ?? 0,
      presetSubtype: xmlNumber(cTn, 'presetSubtype') ?? 0,
      command: xmlDescendants(cTn, 'cmd')[0]?.getAttribute('cmd') ?? undefined,
      trigger,
      delayMs: delayOf(cTn),
      durationMs: durationOf(cTn),
      clickGroup,
    }
  })
}

/**
 * A slide's timing tree (`p:timing`): its main sequence's effects in play
 * order, each top-level `p:par` one click (the first plays by itself when it
 * starts on the slide's own start, `evt="onBegin"`); its videos' and sounds'
 * volume and mute; and how many effects start on a click on a shape
 * (`interactiveSeq`).
 */
export function readTiming(slide: Document): PptxTiming {
  const timing: PptxTiming = { effects: [], media: new Map(), interactive: 0 }
  const root = xmlChild(
    slide.documentElement,
    'timing',
    'tnLst',
    'par',
    'cTn',
    'childTnLst',
  )
  for (const node of xmlChildren(root)) {
    if (node.localName === 'video' || node.localName === 'audio') {
      const media = xmlChild(node, 'cMediaNode')
      const spid = xmlDescendants(media, 'spTgt')[0]?.getAttribute('spid')
      const volume = xmlNumber(media, 'vol')
      if (spid) {
        timing.media.set(spid, {
          volume:
            volume === undefined ? undefined : Math.min(1, volume / 100_000),
          muted: media?.getAttribute('mute') === '1' || undefined,
        })
      }
      continue
    }
    if (node.localName !== 'seq') continue
    const cTn = xmlChild(node, 'cTn')
    if (cTn?.getAttribute('nodeType') === 'interactiveSeq') {
      timing.interactive += xmlDescendants(cTn, 'cTn').filter((c) =>
        c.hasAttribute('presetClass'),
      ).length
      continue
    }
    if (cTn?.getAttribute('nodeType') !== 'mainSeq') continue
    let clickGroup = 0
    for (const par of xmlChildren(xmlChild(cTn, 'childTnLst'), 'par')) {
      const conditions = xmlChildren(
        xmlChild(xmlChild(par, 'cTn'), 'stCondLst'),
        'cond',
      )
      const automatic =
        clickGroup === 0 &&
        conditions.some((c) => c.getAttribute('evt') === 'onBegin')
      if (!automatic) clickGroup += 1
      timing.effects.push(...readClickGroup(par, clickGroup, automatic))
    }
  }
  return timing
}
