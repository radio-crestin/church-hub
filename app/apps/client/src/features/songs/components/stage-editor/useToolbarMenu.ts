import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A small menu hanging off a control in the stage formatting bar.
 *
 * The panel is portalled to the body so the stage's own clipping cannot cut it
 * off, which is also why closing on an outside click has to be told about it:
 * the panel is not inside the anchor, and a press that unmounted it would take
 * the click that was meant for the row with it.
 */
export function useToolbarMenu<
  Anchor extends HTMLElement,
  Panel extends HTMLElement,
>() {
  const anchorRef = useRef<Anchor>(null)
  const panelRef = useRef<Panel>(null)
  const [at, setAt] = useState<{ top: number; left: number } | null>(null)

  const close = useCallback(() => setAt(null), [])
  const open = useCallback(() => {
    const box = anchorRef.current?.getBoundingClientRect()
    if (!box) return
    setAt({ top: box.bottom + 4, left: box.left })
  }, [])
  const toggle = useCallback(() => {
    if (at) {
      close()
      return
    }
    open()
  }, [at, open, close])

  useEffect(() => {
    if (!at) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (anchorRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setAt(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAt(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [at])

  return { anchorRef, panelRef, at, open, close, toggle }
}
