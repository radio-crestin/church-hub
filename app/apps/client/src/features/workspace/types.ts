import type { ReactNode } from 'react'

/**
 * A single movable, resizable view inside a Workspace.
 *
 * Pages declare their panels once; where each panel *sits* is owned by the
 * operator (and persisted per device), not by the page.
 */
export interface WorkspacePanel {
  /** Stable id — also the localStorage identity of this panel's position. */
  id: string
  /** Human label shown while dragging and in the move handle's tooltip. */
  title: string
  /** Renders the panel body. Called on every render, so keep it cheap. */
  render: () => ReactNode
  /**
   * `false` hides the panel completely (e.g. the operator lacks the permission
   * to see it). Hidden panels keep their stored position for when they return.
   */
  available?: boolean
  /** Smallest size this panel may be dragged to, as a CSS size. Default `"10%"`. */
  minSize?: string
  /** Height this panel opens at before the operator resizes it, e.g. `"40%"`. */
  defaultSize?: string
  /**
   * `true` when the panel's own collapse chevron is closed. The row then
   * shrinks to its header height and gives the space to its neighbours.
   *
   * Declaring this at all — `true` or `false` — is what tells the workspace
   * the panel has a header worth keeping: its row stops at that header when a
   * divider is dragged onto it, instead of disappearing. Mark the header
   * element with `data-panel-header` so it can be measured. A panel that
   * leaves this undefined is hidden outright by the same drag.
   */
  collapsed?: boolean
}

/** One vertical stack of panels. Columns sit side by side, left to right. */
export interface WorkspaceColumn {
  id: string
  panelIds: string[]
}

/** Which panel lives where. Sizes are persisted separately by the panel group. */
export interface WorkspaceLayout {
  columns: WorkspaceColumn[]
}

/**
 * Where a dragged panel lands relative to the panel it was dropped on:
 * `top`/`bottom` reorder inside that panel's column, `left`/`right` split it
 * out into a brand new column beside it.
 */
export type WorkspaceDropEdge = 'top' | 'bottom' | 'left' | 'right'

/** Parsed form of a drop-zone id. */
export interface WorkspaceDropTarget {
  columnId: string
  panelId: string
  edge: WorkspaceDropEdge
}
