import type { UpdateInstallerLabels } from './types'

export interface WindowsUpdaterParams {
  installerPath: string
  installDir: string
  launchPath: string
  /** The Tauri app process — the one holding the files the installer replaces. */
  appPid: number
  /** The sidecar, normally killed by the app on exit; cleaned up if not. */
  sidecarPid: number
  version: string
  logPath: string
  labels: UpdateInstallerLabels
}

/**
 * The Windows installer helper: a PowerShell script that shows a WPF window —
 * title, step, progress bar — while it waits for the app to exit, runs the
 * NSIS installer silently and relaunches. PowerShell and WPF ship with every
 * Windows, so nothing needs compiling, and with `-WindowStyle Hidden` no
 * console ever appears.
 *
 * The parameters are baked in as JSON inside a single-quoted here-string, so
 * paths with spaces or odd characters never meet PowerShell's parser.
 */
export function buildWindowsUpdater(params: WindowsUpdaterParams): string {
  const json = JSON.stringify(params)
  return `$ErrorActionPreference = 'Continue'
$P = @'
${json}
'@ | ConvertFrom-Json

function Log($message) {
  Add-Content -LiteralPath $P.logPath -Encoding UTF8 -Value ("{0} {1}" -f (Get-Date -Format o), $message) -ErrorAction SilentlyContinue
}

# ---- window ---------------------------------------------------------------
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

[xml]$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Width="440" Height="230" ResizeMode="NoResize" WindowStyle="None"
        WindowStartupLocation="CenterScreen" Topmost="True" ShowInTaskbar="True"
        Background="#FFFFFF" FontFamily="Segoe UI">
  <Border BorderBrush="#E5E7EB" BorderThickness="1">
    <Grid Margin="32,28,32,24">
      <Grid.RowDefinitions>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="*"/>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="Auto"/>
      </Grid.RowDefinitions>
      <TextBlock x:Name="Title" Grid.Row="0" FontSize="22" FontWeight="SemiBold" Foreground="#111827"/>
      <TextBlock x:Name="Step" Grid.Row="1" FontSize="13" Foreground="#6B7280" Margin="0,6,0,0" TextWrapping="Wrap"/>
      <ProgressBar x:Name="Bar" Grid.Row="3" Height="8" Minimum="0" Maximum="100" Value="5"
                   Foreground="#4F46E5" Background="#E5E7EB" BorderThickness="0"/>
      <TextBlock x:Name="Hint" Grid.Row="4" FontSize="11" Foreground="#9CA3AF" Margin="0,14,0,0" TextWrapping="Wrap"/>
    </Grid>
  </Border>
</Window>
'@

$reader = New-Object System.Xml.XmlNodeReader $xaml
$window = [Windows.Markup.XamlReader]::Load($reader)
$title = $window.FindName('Title')
$step = $window.FindName('Step')
$bar = $window.FindName('Bar')
$hint = $window.FindName('Hint')
$title.Text = $P.labels.title
$step.Text = $P.labels.closing
$hint.Text = $P.labels.hint
$window.Show() | Out-Null
$window.Activate() | Out-Null

function Pump() {
  $window.Dispatcher.Invoke([Action]{}, [Windows.Threading.DispatcherPriority]::Background)
}
function Show($text, $progress) {
  $step.Text = $text
  $bar.Value = $progress
  Pump
}
function Wait-Seconds($seconds) {
  $until = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $until) { Pump; Start-Sleep -Milliseconds 50 }
}

# ---- helpers --------------------------------------------------------------
function Is-Alive($processId) {
  if ($processId -le 0) { return $false }
  return $null -ne (Get-Process -Id $processId -ErrorAction SilentlyContinue)
}

# Waits for the process to go away on its own; after the grace period it is
# terminated so the update never stalls on an app that did not exit.
function Wait-ForExit($processId, $graceSeconds) {
  $deadline = (Get-Date).AddSeconds($graceSeconds)
  while ((Is-Alive $processId) -and ((Get-Date) -lt $deadline)) { Pump; Start-Sleep -Milliseconds 100 }
  if (Is-Alive $processId) {
    Log "pid $processId still running after \${graceSeconds}s; terminating"
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    $hardDeadline = (Get-Date).AddSeconds(5)
    while ((Is-Alive $processId) -and ((Get-Date) -lt $hardDeadline)) { Pump; Start-Sleep -Milliseconds 100 }
  }
  return -not (Is-Alive $processId)
}

function Fail($reason) {
  Log "FAILED: $reason"
  $window.Hide()
  $text = $P.labels.failed.Replace('{{reason}}', $reason) + "\`n\`n" + $P.labels.openManually
  [Windows.MessageBox]::Show($text, $P.labels.title, 'OK', 'Warning') | Out-Null
  exit 1
}

# ---- the update -----------------------------------------------------------
Log "updating $($P.installDir) to $($P.version) from $($P.installerPath)"

Show $P.labels.closing 10
if (-not (Wait-ForExit $P.appPid 15)) { Fail 'the running app could not be closed' }
if (Is-Alive $P.sidecarPid) {
  Log "sidecar $($P.sidecarPid) outlived the app; terminating"
  Stop-Process -Id $P.sidecarPid -Force -ErrorAction SilentlyContinue
}
# Let Windows release the file locks of the process that just went away.
Wait-Seconds 1

Show $P.labels.installing 30
# A per-machine install (Program Files) needs elevation; the silent installer
# cannot ask for it itself, so the prompt is raised here instead.
$programFiles = @($env:ProgramFiles, \${env:ProgramFiles(x86)}) | Where-Object { $_ }
$elevate = $false
foreach ($root in $programFiles) {
  if ($P.installDir.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { $elevate = $true }
}
try {
  if ($elevate) {
    $installer = Start-Process -FilePath $P.installerPath -ArgumentList '/S' -Verb RunAs -PassThru
  } else {
    $installer = Start-Process -FilePath $P.installerPath -ArgumentList '/S' -PassThru
  }
} catch {
  Fail "the installer could not be started ($($_.Exception.Message))"
}
$started = Get-Date
while (-not $installer.HasExited) {
  Pump
  Start-Sleep -Milliseconds 100
  $elapsed = ((Get-Date) - $started).TotalSeconds
  $bar.Value = [Math]::Min(85, 30 + $elapsed * 2)
}
Log "installer exited with $($installer.ExitCode)"
if ($installer.ExitCode -ne 0) { Fail "the installer reported an error (code $($installer.ExitCode))" }
if (-not (Test-Path -LiteralPath $P.launchPath)) { Fail "the installed application was not found at $($P.launchPath)" }

Show $P.labels.launching 90
try {
  Start-Process -FilePath $P.launchPath -WorkingDirectory $P.installDir | Out-Null
} catch {
  Fail "the new version could not be started ($($_.Exception.Message))"
}

Show $P.labels.launching 100
Log 'done'
Wait-Seconds 1.2
$window.Close()
exit 0
`
}
