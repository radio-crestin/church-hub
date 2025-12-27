interface KioskScreenDimOverlayProps {
  onDismiss: () => void
}

/**
 * Full-screen black overlay for kiosk mode when WebSocket disconnects
 * Tapping anywhere dismisses the overlay
 */
export function KioskScreenDimOverlay({
  onDismiss,
}: KioskScreenDimOverlayProps) {
  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDismiss()
  }

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black cursor-pointer"
      onClick={handleInteraction}
      onTouchStart={handleInteraction}
      aria-label="Screen dimmed due to connection loss. Tap to restore."
      role="button"
      tabIndex={0}
    />
  )
}
