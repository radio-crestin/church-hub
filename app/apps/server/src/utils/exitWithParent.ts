/**
 * The desktop shell starts the sidecar with a pipe on its stdin, which only
 * the shell holds, and sets CHURCH_HUB_EXIT_WITH_PARENT. When the shell ends
 * in any way (quit, SIGTERM, force quit, crash, logout), the OS closes that
 * pipe and stdin reaches its end: the sidecar then shuts down instead of
 * living on and holding its port (T-149).
 *
 * Off unless the shell asks for it: a sidecar started any other way (the
 * smoke test, a terminal) may have a stdin that is closed from the start.
 */
export function exitWithParent(shutdown: () => Promise<void>): void {
  if (process.env.CHURCH_HUB_EXIT_WITH_PARENT !== 'true') return

  let gone = false
  const onParentGone = () => {
    if (gone) return
    gone = true
    // biome-ignore lint/suspicious/noConsole: Shutdown reason for the logs
    console.log('[shutdown] The desktop shell is gone: shutting down')
    void shutdown()
  }
  process.stdin.on('end', onParentGone)
  process.stdin.on('close', onParentGone)
  // The shell writes nothing the sidecar needs: drain it so 'end' can fire.
  process.stdin.resume()
}

/**
 * The shell's pid while it asks the sidecar to end with it, else 0. The boot
 * server's worker watches it: the main thread's long synchronous boot work
 * (migrations, seeding, search index) holds back the stdin 'end' event.
 */
export function parentToWatch(): number {
  return process.env.CHURCH_HUB_EXIT_WITH_PARENT === 'true' ? process.ppid : 0
}
