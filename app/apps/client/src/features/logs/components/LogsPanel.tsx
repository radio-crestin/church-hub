import { isLocalhost } from '~/config'
import { ClearLogs } from './ClearLogs'
import { LogsViewer } from './LogsViewer'
import { OpenLogsFolder } from './OpenLogsFolder'
import { useLogsContent } from '../hooks/useLogsContent'

/**
 * The full Logs settings panel: a read-only viewer of the recent log tails,
 * plus actions to open the logs folder (host machine only) and clear the logs
 * (gated by `logs.clear`). The surrounding route gates the whole panel behind
 * `logs.view`.
 */
export function LogsPanel() {
  const { data, isLoading, error, refresh } = useLogsContent()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Opening a folder only makes sense on the machine running the app. */}
        {isLocalhost() && <OpenLogsFolder />}
        <ClearLogs onCleared={refresh} />
      </div>

      <LogsViewer
        data={data}
        isLoading={isLoading}
        error={error}
        onRefresh={refresh}
      />
    </div>
  )
}
