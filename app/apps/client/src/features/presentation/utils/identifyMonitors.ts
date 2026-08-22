import { listMonitors, monitorInLogicalUnits } from './monitors'
import { getFrontendUrl, isTauri } from './openDisplayWindow'

/** How long a badge stays up before it takes itself away. */
const BADGE_MS = 3000

/** Size of the badge, and how far it sits from the corner. In logical pixels. */
const BADGE_WIDTH = 220
const BADGE_HEIGHT = 160
const BADGE_MARGIN = 48

/** Label prefix, kept in step with the window capability in tauri.conf. */
const BADGE_LABEL = 'monitor-badge-'

/**
 * Flashes a number in the corner of each display, the way the OS display
 * settings do, so the operator can tell which monitor is which before assigning
 * a screen to one.
 *
 * The number is the monitor's place in the list the settings show, so the badge
 * on the wall and the entry in the dropdown carry the same one.
 *
 * @param monitorName Only badge this monitor, or every monitor when omitted.
 */
export async function identifyMonitors(monitorName?: string): Promise<void> {
  if (!isTauri()) return

  const monitors = await listMonitors()
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')

  await Promise.all(
    monitors.map(async (monitor, index) => {
      if (monitorName && monitor.name !== monitorName) return

      const number = index + 1
      const label = `${BADGE_LABEL}${number}`
      const bounds = monitorInLogicalUnits(monitor)

      // A badge already up is taken down first: asking twice in a row should
      // restart the countdown, not fail on a label that is still taken.
      const existing = await WebviewWindow.getByLabel(label)
      if (existing) await existing.close()

      const badge = new WebviewWindow(label, {
        url: `${getFrontendUrl()}/monitor-badge/${number}`,
        width: BADGE_WIDTH,
        height: BADGE_HEIGHT,
        x: bounds.x + BADGE_MARGIN,
        y: bounds.y + bounds.height - BADGE_HEIGHT - BADGE_MARGIN,
        decorations: false,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        // Never takes the keyboard: the operator is in the middle of picking a
        // monitor, and a badge stealing focus would close the dropdown.
        focus: false,
        shadow: false,
        backgroundColor: '#000000',
      })

      setTimeout(async () => {
        try {
          await badge.close()
        } catch (error) {
          // biome-ignore lint/suspicious/noConsole: Error logging
          console.error('[identifyMonitors] Failed to close badge:', error)
        }
      }, BADGE_MS)
    }),
  )
}
