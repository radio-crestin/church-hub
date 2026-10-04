import type { WorkspaceLayout } from '../types'

/** Comparable snapshot of *which panel sits where*, ignoring column ids. */
export function panelOrder(layout: WorkspaceLayout): string {
  return layout.columns.map((column) => column.panelIds.join(',')).join('|')
}
