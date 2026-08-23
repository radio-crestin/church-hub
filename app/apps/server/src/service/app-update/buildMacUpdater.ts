import type { UpdateInstallerLabels } from './types'

export interface MacUpdaterParams {
  dmgPath: string
  appPath: string
  /** The Tauri app process — the one that has to be gone before the swap. */
  appPid: number
  /** The sidecar, normally killed by the app on exit; cleaned up if not. */
  sidecarPid: number
  version: string
  logPath: string
  labels: UpdateInstallerLabels
}

/**
 * The macOS installer helper: a JavaScript-for-Automation script run by
 * `osascript`, which is on every Mac and needs no compiling. Through the
 * ObjC bridge it puts up a native AppKit window — title, step, progress
 * bar — while it waits for the app to quit, swaps the bundle from the .dmg
 * and relaunches. Nothing the operator sees is a terminal.
 *
 * The parameters are baked into the script as JSON, so there is no argument
 * quoting to get wrong. Note that `run` is osascript's reserved entry point:
 * no function in here may use that name.
 */
export function buildMacUpdater(params: MacUpdaterParams): string {
  return `ObjC.import('Cocoa')
ObjC.import('signal')
ObjC.import('stdlib')

const P = ${JSON.stringify(params)}

// ---- logging -------------------------------------------------------------
const lines = []
function log(message) {
  const stamp = $.NSDate.date.description.js
  lines.push(stamp + ' ' + message)
  $(lines.join('\\n') + '\\n').writeToFileAtomicallyEncodingError(P.logPath, true, $.NSUTF8StringEncoding, null)
}

// ---- window --------------------------------------------------------------
const app = $.NSApplication.sharedApplication
app.setActivationPolicy($.NSApplicationActivationPolicyRegular)
const iconPath = P.appPath + '/Contents/Resources/icon.icns'
if ($.NSFileManager.defaultManager.fileExistsAtPath(iconPath)) {
  app.applicationIconImage = $.NSImage.alloc.initWithContentsOfFile(iconPath)
}

const W = 440
const H = 230
const win = $.NSWindow.alloc.initWithContentRectStyleMaskBackingDefer(
  $.NSMakeRect(0, 0, W, H),
  $.NSWindowStyleMaskTitled | $.NSWindowStyleMaskFullSizeContentView,
  $.NSBackingStoreBuffered,
  false,
)
win.titlebarAppearsTransparent = true
win.titleVisibility = $.NSWindowTitleHidden
win.movableByWindowBackground = true
win.backgroundColor = $.NSColor.windowBackgroundColor
win.level = $.NSFloatingWindowLevel
win.center

const content = win.contentView
function label(text, y, size, weight, color) {
  const field = $.NSTextField.alloc.initWithFrame($.NSMakeRect(32, y, W - 64, size + 10))
  field.stringValue = text
  field.editable = false
  field.bezeled = false
  field.drawsBackground = false
  field.selectable = false
  field.font = $.NSFont.systemFontOfSizeWeight(size, weight)
  field.textColor = color
  content.addSubview(field)
  return field
}
label(P.labels.title, H - 78, 22, $.NSFontWeightSemibold, $.NSColor.labelColor)
const step = label(P.labels.closing, H - 108, 13, $.NSFontWeightRegular, $.NSColor.secondaryLabelColor)
const bar = $.NSProgressIndicator.alloc.initWithFrame($.NSMakeRect(32, 54, W - 64, 8))
bar.style = $.NSProgressIndicatorStyleBar
bar.indeterminate = false
bar.minValue = 0
bar.maxValue = 100
bar.doubleValue = 5
content.addSubview(bar)
const hint = label(P.labels.hint, 24, 11, $.NSFontWeightRegular, $.NSColor.tertiaryLabelColor)

win.makeKeyAndOrderFront(null)
app.activateIgnoringOtherApps(true)

function pump(seconds) {
  $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(seconds))
}
function show(text, progress) {
  step.stringValue = text
  bar.doubleValue = progress
  pump(0.05)
}

// ---- helpers -------------------------------------------------------------
// The processes that belong to the installed app: everything whose
// executable lives inside the bundle (the app itself, the sidecar, helpers).
// Decided by path, never by a bare process id — an id handed over by the
// caller is only a hint and is never trusted on its own, so a stale or wrong
// one can never have some unrelated process terminated.
function appProcesses() {
  const prefix = P.appPath.replace(/\\/+$/, '') + '/Contents/MacOS/'
  // -ww: unlimited width, otherwise the path is cut to a few characters.
  // command= is argv as launched, which for a bundle is the full path.
  const listing = runTask('/bin/ps', ['-axww', '-o', 'pid=,command='], { quiet: true })
  const pids = []
  for (const line of listing.output.split('\\n')) {
    const match = line.match(/^\\s*(\\d+)\\s+(.*)$/)
    if (match && match[2].startsWith(prefix)) pids.push(Number(match[1]))
  }
  return pids
}

// Waits for the app's processes to go away on their own; after the grace
// period they are terminated so the update never stalls on an app that did
// not quit.
function waitForAppToQuit(graceSeconds) {
  const deadline = Date.now() + graceSeconds * 1000
  let remaining = appProcesses()
  while (remaining.length > 0 && Date.now() < deadline) {
    pump(0.25)
    remaining = appProcesses()
  }
  if (remaining.length > 0) {
    log('still running after ' + graceSeconds + 's: ' + remaining.join(', ') + '; terminating')
    for (const pid of remaining) $.kill(pid, 9)
    const hardDeadline = Date.now() + 5000
    remaining = appProcesses()
    while (remaining.length > 0 && Date.now() < hardDeadline) {
      pump(0.25)
      remaining = appProcesses()
    }
  }
  return remaining.length === 0
}

// Output goes to a temp file rather than a pipe: a pipe must be drained
// while the task runs or a chatty command (ps on a busy Mac) fills it and
// deadlocks, and draining it would mean not pumping the window meanwhile.
let taskCounter = 0
function runTask(command, args, options) {
  const outputPath = $.NSTemporaryDirectory().js + 'church-hub-update-task-' + $.NSProcessInfo.processInfo.processIdentifier + '-' + (taskCounter++) + '.txt'
  $.NSFileManager.defaultManager.createFileAtPathContentsAttributes(outputPath, $(), $())
  const handle = $.NSFileHandle.fileHandleForWritingAtPath(outputPath)
  const task = $.NSTask.alloc.init
  task.launchPath = command
  task.arguments = args
  task.standardOutput = handle
  task.standardError = handle
  task.launch
  while (task.isRunning) pump(0.1)
  handle.closeFile
  const output = $.NSString.stringWithContentsOfFileEncodingError(outputPath, $.NSUTF8StringEncoding, null)
  $.NSFileManager.defaultManager.removeItemAtPathError(outputPath, null)
  const text = output.isNil() ? '' : output.js.trim()
  if (!(options && options.quiet)) {
    log('$ ' + command + ' ' + args.join(' ') + ' -> ' + task.terminationStatus + (text ? '\\n' + text : ''))
  }
  return { status: task.terminationStatus, output: text }
}

function fail(reason) {
  log('FAILED: ' + reason)
  const alert = $.NSAlert.alloc.init
  alert.messageText = P.labels.failed.replace('{{reason}}', reason)
  alert.informativeText = P.labels.openManually
  alert.alertStyle = $.NSAlertStyleWarning
  win.orderOut(null)
  alert.runModal
  $.exit(1)
}

// ---- the update ----------------------------------------------------------
log('updating ' + P.appPath + ' to ' + P.version + ' from ' + P.dmgPath + ' (app pid ' + P.appPid + ', sidecar pid ' + P.sidecarPid + ')')

show(P.labels.closing, 10)
if (!waitForAppToQuit(15)) fail('the running app could not be closed')

show(P.labels.installing, 30)
const mountPoint = '/tmp/church-hub-update-' + Date.now()
$.NSFileManager.defaultManager.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(mountPoint, true, $(), null)
const attach = runTask('/usr/bin/hdiutil', ['attach', P.dmgPath, '-nobrowse', '-quiet', '-mountpoint', mountPoint])
if (attach.status !== 0) fail('the disk image could not be opened (' + attach.output + ')')

let newApp = null
const entries = $.NSFileManager.defaultManager.contentsOfDirectoryAtPathError(mountPoint, null)
for (let i = 0; i < entries.count; i++) {
  const name = entries.objectAtIndex(i).js
  if (name.endsWith('.app')) {
    newApp = mountPoint + '/' + name
    break
  }
}
if (!newApp) {
  runTask('/usr/bin/hdiutil', ['detach', mountPoint, '-quiet'])
  fail('no application found in the disk image')
}

show(P.labels.installing, 50)
// Copy next to the installed bundle first and only then swap, so a copy that
// fails halfway (disk full, image gone) leaves the current version in place.
const staged = P.appPath.replace(/\\/+$/, '') + '.update'
runTask('/bin/rm', ['-rf', staged])
// ditto preserves the bundle's structure, symlinks and code signature.
const copy = runTask('/usr/bin/ditto', [newApp, staged])
runTask('/usr/bin/hdiutil', ['detach', mountPoint, '-quiet'])
runTask('/bin/rmdir', [mountPoint])
if (copy.status !== 0) {
  runTask('/bin/rm', ['-rf', staged])
  fail('the application could not be copied (' + copy.output + ')')
}
runTask('/bin/rm', ['-rf', P.appPath])
const swap = runTask('/bin/mv', [staged, P.appPath])
if (swap.status !== 0) fail('the application could not be moved into place (' + swap.output + ')')
// Clear the download quarantine so the swapped bundle opens without a prompt.
runTask('/usr/bin/xattr', ['-dr', 'com.apple.quarantine', P.appPath])

show(P.labels.launching, 90)
const launch = runTask('/usr/bin/open', ['-a', P.appPath])
if (launch.status !== 0) fail('the new version could not be started (' + launch.output + ')')

show(P.labels.launching, 100)
log('done')
pump(1.2)
$.exit(0)
`
}
