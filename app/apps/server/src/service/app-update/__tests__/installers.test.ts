import { describe, expect, test } from 'bun:test'
import { buildMacUpdater } from '../buildMacUpdater'
import { buildWindowsUpdater } from '../buildWindowsUpdater'
import type { UpdateInstallerLabels } from '../types'

const labels: UpdateInstallerLabels = {
  title: 'Church Hub',
  closing: 'Se închide aplicația…',
  installing: 'Se instalează versiunea 9.9.9…',
  launching: 'Se pornește noua versiune…',
  hint: 'Aplicația se redeschide singură când e gata.',
  failed: 'Actualizarea nu a reușit: {{reason}}',
  openManually: 'Deschide Church Hub manual.',
}

describe('buildMacUpdater', () => {
  const script = buildMacUpdater({
    dmgPath: '/Users/Ion Pop/Downloads/church-hub-macos-arm64-v-9.9.9.dmg',
    appPath: '/Applications/Church Hub.app',
    appPid: 1234,
    sidecarPid: 5678,
    version: '9.9.9',
    logPath:
      '/Users/Ion Pop/Library/Application Support/church-hub/church-hub-update.log',
    labels,
  })

  test('bakes the parameters in as JSON, paths with spaces included', () => {
    const line = script.split('\n').find((l) => l.startsWith('const P = '))
    expect(line).toBeDefined()
    const params = JSON.parse(line!.slice('const P = '.length))
    expect(params.appPath).toBe('/Applications/Church Hub.app')
    expect(params.appPid).toBe(1234)
    expect(params.labels.installing).toBe('Se instalează versiunea 9.9.9…')
  })

  test("never defines osascript's reserved `run` entry point", () => {
    expect(script).not.toMatch(/function run\(/)
  })

  test('waits for the app, swaps the bundle from the image and relaunches', () => {
    expect(script).toContain('waitForAppToQuit(15)')
    // Processes are found by executable path; a bare pid is never killed.
    expect(script).toContain("'/Contents/MacOS/'")
    expect(script).not.toMatch(/\$\.kill\(P\./)
    // The new bundle is staged beside the old one before the swap.
    expect(script).toContain("'.update'")
    expect(script).toContain("'/usr/bin/hdiutil', ['attach'")
    expect(script).toContain("'/usr/bin/ditto'")
    expect(script).toContain("'/usr/bin/open', ['-a', P.appPath]")
    expect(script).toContain('NSProgressIndicator')
  })
})

describe('buildWindowsUpdater', () => {
  const script = buildWindowsUpdater({
    installerPath:
      'C:\\Users\\Ion Pop\\Downloads\\church-hub-windows-x64-v-9.9.9.exe',
    installDir: 'C:\\Users\\Ion Pop\\AppData\\Local\\church-hub',
    launchPath:
      'C:\\Users\\Ion Pop\\AppData\\Local\\church-hub\\church-hub.exe',
    appPid: 1234,
    sidecarPid: 5678,
    version: '9.9.9',
    logPath:
      'C:\\Users\\Ion Pop\\AppData\\Roaming\\church-hub\\church-hub-update.log',
    labels,
  })

  test('bakes the parameters in as a JSON here-string', () => {
    const match = script.match(/\$P = @'\n(.*)\n'@ \| ConvertFrom-Json/)
    expect(match).not.toBeNull()
    const params = JSON.parse(match![1])
    expect(params.launchPath).toBe(
      'C:\\Users\\Ion Pop\\AppData\\Local\\church-hub\\church-hub.exe',
    )
    expect(params.labels.failed).toBe('Actualizarea nu a reușit: {{reason}}')
  })

  test('leaves PowerShell interpolation to PowerShell', () => {
    // These must survive as PowerShell syntax, not be eaten by the template.
    expect(script).toContain('after ${graceSeconds}s')
    expect(script).toContain('${env:ProgramFiles(x86)}')
    expect(script).not.toContain('undefined')
  })

  test('waits for the app, runs the installer silently and relaunches', () => {
    expect(script).toContain('Wait-ForAppToExit 15')
    // Processes are found by executable path; a bare pid is never killed.
    expect(script).toContain('$P.installDir.TrimEnd($separator) + $separator')
    expect(script).not.toContain('Stop-Process -Id $P.')
    expect(script).toContain("-ArgumentList '/S'")
    expect(script).toContain('-Verb RunAs')
    expect(script).toContain('Start-Process -FilePath $P.launchPath')
    expect(script).toContain('<ProgressBar')
  })
})
