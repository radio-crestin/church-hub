import type { DeckElementBase, DeckTextElement } from '../../types'
import { escapeHtml } from '../../utils/escapeHtml'
import { xmlChildren } from '../xml/xmlChildren'
import { xmlDescendants } from '../xml/xmlDescendants'

/**
 * A table (`a:tbl`) as a text box of its rows, a row a paragraph with its
 * cells side by side: the deck has no tables. Null when it holds no text.
 */
export function tableElement(
  table: Element,
  base: DeckElementBase,
  pointPx: number,
): DeckTextElement | null {
  const rows = xmlChildren(table, 'tr').map((row) =>
    xmlChildren(row, 'tc')
      .map((cell) =>
        xmlDescendants(cell, 'p')
          .map((p) =>
            xmlDescendants(p, 't')
              .map((t) => t.textContent)
              .join(''),
          )
          .join(' '),
      )
      .join('   |   '),
  )
  if (!rows.some((row) => row.replace(/[\s|]/g, ''))) return null
  return {
    ...base,
    type: 'text',
    html: rows.map((row) => `<p>${escapeHtml(row)}</p>`).join(''),
    fontSize: Math.round(18 * pointPx * 100) / 100,
    color: '#000000',
    padding: 0,
  }
}
