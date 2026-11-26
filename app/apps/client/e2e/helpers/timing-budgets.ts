/**
 * Whether millisecond budgets (frame times, fade lengths, start delays) are
 * checked on this machine. GitHub's runners are GPU-less shared VMs whose
 * frame rate swings from run to run (WebKit 18-561 ms per frame, a macOS
 * runner drawing Chromium at 30 fps), so a budget there times the runner.
 * What the change does (never two slides at once, fades in step) is checked
 * everywhere; how fast, only on real machines.
 */
export const checksTimingBudgets = !process.env.GITHUB_ACTIONS
