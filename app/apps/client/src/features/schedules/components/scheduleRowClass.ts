interface ScheduleRowState {
  isDragging: boolean
  isLive: boolean
  /** Open on the song or Bible page right now. */
  isActive?: boolean
}

/** The fill of one flat program row: live outline, grey selection, or hover. */
export function scheduleRowClass({
  isDragging,
  isLive,
  isActive = false,
}: ScheduleRowState) {
  if (isDragging)
    return 'bg-panel opacity-90 ring-1 ring-inset ring-line-strong'
  if (isLive) return 'bg-live-tint ring-1 ring-inset ring-live'
  if (isActive) return 'bg-selected'
  return 'hover:bg-hover'
}
