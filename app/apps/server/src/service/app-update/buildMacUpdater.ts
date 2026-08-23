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
function isAlive(pid) {
  return pid > 0 && $.kill(pid, 0) === 0
}

// Waits for the process to go away on its own; after the grace period it is
// terminated so the update never stalls on an app that did not quit.
function waitForExit(pid, graceSeconds) {
  const deadline = Date.now() + graceSeconds * 1000
  while (isAlive(pid) && Date.now() < deadline) pump(0.1)
  if (isAlive(pid)) {
    log('pid ' + pid + ' still running after ' + graceSeconds + 's; terminating')
    $.kill(pid, 9)
    const hardDeadline = Date.now() + 5000
    while (isAlive(pid) && Date.now() < hardDeadline) pump(0.1)
  }
  return !isAlive(pid)
}

function runTask(command, args) {
  const task = $.NSTask.alloc.init
  task.launchPath = command
  task.arguments = args
  const pipe = $.NSPipe.pipe
  task.standardOutput = pipe
  task.standardError = pipe
  task.launch
  while (task.isRunning) pump(0.1)
  const data = pipe.fileHandleForReading.readDataToEndOfFile
  const output = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding)
  const text = output.isNil() ? '' : output.js.trim()
  log('$ ' + command + ' ' + args.join(' ') + ' -> ' + task.terminationStatus + (text ? '\\n' + text : ''))
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
log('updating ' + P.appPath + ' to ' + P.version + ' from ' + P.dmgPath)

show(P.labels.closing, 10)
if (!waitForExit(P.appPid, 15)) fail('the running app could not be closed')
if (isAlive(P.sidecarPid)) {
  log('sidecar ' + P.sidecarPid + ' outlived the app; terminating')
  $.kill(P.sidecarPid, 9)
}

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
runTask('/bin/rm', ['-rf', P.appPath])
// ditto preserves the bundle's structure, symlinks and code signature.
const copy = runTask('/usr/bin/ditto', [newApp, P.appPath])
runTask('/usr/bin/hdiutil', ['detach', mountPoint, '-quiet'])
runTask('/bin/rmdir', [mountPoint])
if (copy.status !== 0) fail('the application could not be copied (' + copy.output + ')')
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
