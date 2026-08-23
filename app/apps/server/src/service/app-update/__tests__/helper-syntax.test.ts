import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, test } from 'bun:test'
import { buildMacUpdater } from '../buildMacUpdater'
import { buildWindowsUpdater } from '../buildWindowsUpdater'
import type { UpdateInstallerLabels } from '../types'

/**
 * The generated helpers are run by osascript / Windows PowerShell, not by
 * anything this test suite can execute — but each platform's own parser can
 * at least vouch for the syntax. Runs where the tool exists (macOS, Windows)
 * and is skipped elsewhere.
 */

const labels: UpdateInstallerLabels = {
  title: 'Church Hub',
  closing: 'Se închide aplicația…',
  installing: 'Se instalează versiunea 9.9.9…',
  launching: 'Se pornește noua versiune…',
  hint: 'Aplicația se redeschide singură când e gata.',
  failed: 'Actualizarea nu a reușit: {{reason}}',
  openManually: 'Deschide Church Hub manual.',
}

const dir = mkdtempSync(join(tmpdir(), 'church-hub-helper-syntax-'))

describe('generated helper scripts parse on their platform', () => {
  test.skipIf(process.platform !== 'darwin')(
    'macOS: osacompile accepts the JXA',
    () => {
      const script = buildMacUpdater({
        dmgPath: '/Users/Ion Pop/Downloads/church-hub.dmg',
        appPath: '/Applications/Church Hub.app',
        appPid: 1,
        sidecarPid: 2,
        version: '9.9.9',
        logPath: join(dir, 'update.log'),
        labels,
      })
      const file = join(dir, 'church-hub-update.js')
      writeFileSync(file, script)
      execFileSync(
        '/usr/bin/osacompile',
        ['-l', 'JavaScript', '-o', join(dir, 'compiled.scpt'), file],
        { stdio: 'pipe', timeout: 30_000 },
      )
      rmSync(dir, { recursive: true, force: true })
    },
  )

  test.skipIf(process.platform !== 'win32')(
    'Windows: PowerShell parses the script',
    () => {
      const script = buildWindowsUpdater({
        installerPath: 'C:\\Users\\Ion Pop\\Downloads\\church-hub.exe',
        installDir: 'C:\\Users\\Ion Pop\\AppData\\Local\\church-hub',
        launchPath:
          'C:\\Users\\Ion Pop\\AppData\\Local\\church-hub\\church-hub.exe',
        appPid: 1,
        sidecarPid: 2,
        version: '9.9.9',
        logPath: join(dir, 'update.log'),
        labels,
      })
      const file = join(dir, 'church-hub-update.ps1')
      writeFileSync(file, `\ufeff${script}`)
      const check = [
        '$errors = $null',
        `[System.Management.Automation.Language.Parser]::ParseFile('${file.replace(/'/g, "''")}', [ref]$null, [ref]$errors) | Out-Null`,
        'if ($errors.Count -gt 0) { $errors | ForEach-Object { Write-Error $_.Message }; exit 1 }',
        "'parse ok'",
      ].join('; ')
      const out = execFileSync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', check],
        { stdio: 'pipe', timeout: 60_000 },
      ).toString()
      expect(out).toContain('parse ok')
      rmSync(dir, { recursive: true, force: true })
    },
  )
})
