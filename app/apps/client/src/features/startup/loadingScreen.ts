import type { HealthSnapshot } from './healthSnapshot'
import {
  formatCount,
  type StartupStepKey,
  startupStepText,
  startupText,
} from './startupText'

/**
 * The start-up loading page. Its markup lives in index.html so it paints
 * before any module loads; these helpers fill it in from the server's /health.
 */

const STEP_ORDER: StartupStepKey[] = [
  'database',
  'songs',
  'bibles',
  'search',
  'finishing',
]

const STEP_OF_PHASE: Record<string, StartupStepKey> = {
  migrating: 'database',
  indexing: 'search',
  finalizing: 'finishing',
}

// The furthest step reached: a quick step that comes back (a migration
// after the seeds) never moves the list backwards.
let furthestStepIndex = -1

const byId = (id: string) => document.getElementById(id)

export function updateLoadingMessage(message: string) {
  const el = byId('loading-message')
  if (el) el.textContent = message
}

export function updateLoadingHint(message: string) {
  const el = byId('loading-hint')
  if (el) el.textContent = message
}

function showProgressBar(percent: number, label: string) {
  const box = byId('loading-progress')
  const bar = byId('loading-progress-bar')
  const labelEl = byId('loading-progress-label')
  if (!box || !bar || !labelEl) return
  box.style.display = ''
  bar.style.width = `${Math.min(100, percent).toFixed(1)}%`
  box.setAttribute('aria-valuenow', String(Math.round(Math.min(100, percent))))
  labelEl.textContent = label
}

function hideProgressBar() {
  const box = byId('loading-progress')
  if (box) box.style.display = 'none'
}

function countText(progress: { done: number; total: number }) {
  return startupText('progress', {
    done: formatCount(progress.done),
    total: formatCount(progress.total),
  })
}

/** The current step's own progress (song search), when it reports one. */
function renderProgress(progress: HealthSnapshot['progress']) {
  if (!progress || progress.total <= 0) return hideProgressBar()
  showProgressBar((progress.done / progress.total) * 100, countText(progress))
}

/**
 * A first start's progress across all its steps: the steps done, plus the
 * part of the current step that reports a count.
 */
function renderOverallProgress(
  stepIndex: number,
  progress: HealthSnapshot['progress'],
) {
  const stepPart =
    progress && progress.total > 0 ? progress.done / progress.total : 0
  const percent = ((stepIndex + stepPart) / STEP_ORDER.length) * 100
  const stepLabel = startupText('stepOf', {
    step: String(stepIndex + 1),
    total: String(STEP_ORDER.length),
  })
  showProgressBar(
    percent,
    progress && progress.total > 0
      ? `${stepLabel} · ${countText(progress)}`
      : stepLabel,
  )
}

function renderStepList(currentIndex: number) {
  const list = byId('loading-steps')
  if (!list) return
  list.style.display = ''
  list.replaceChildren(
    ...STEP_ORDER.map((step, index) => {
      const state =
        index < currentIndex
          ? 'done'
          : index === currentIndex
            ? 'active'
            : 'pending'
      const item = document.createElement('li')
      item.dataset.step = step
      item.dataset.state = state
      const mark = document.createElement('span')
      mark.className = 'loading-step-mark'
      mark.textContent = state === 'done' ? '✓' : state === 'active' ? '•' : ''
      item.append(mark, startupStepText(step))
      return item
    }),
  )
}

/** Shows what the server is doing now: the step, its progress, and on a first start every step. */
export function renderStartupProgress(health: HealthSnapshot) {
  const step =
    health.step ?? (health.phase ? STEP_OF_PHASE[health.phase] : undefined)
  if (!step) return
  furthestStepIndex = Math.max(furthestStepIndex, STEP_ORDER.indexOf(step))
  const shownStep = STEP_ORDER[furthestStepIndex] ?? step
  updateLoadingMessage(startupStepText(shownStep))
  const progress = shownStep === step ? health.progress : null
  if (!health.firstRun) return renderProgress(progress)
  renderOverallProgress(furthestStepIndex, progress)
  renderStepList(furthestStepIndex)
  updateLoadingHint(startupText('firstRunHint'))
}

export interface LoadingAction {
  label: string
  onClick: () => void
}

function ensureChild(id: string, tag: string, style: string): HTMLElement {
  let el = byId(id)
  if (!el) {
    el = document.createElement(tag)
    el.id = id
    el.setAttribute('style', style)
    byId('loading-content')?.appendChild(el)
  }
  return el
}

/**
 * Replaces the spinner with what went wrong, an optional technical detail and
 * one button that moves forward (retry, or restart the server). `reported`:
 * false for a notice that is no failure (a revoked screen link).
 */
export function setLoadingError(
  message: string,
  hint: string,
  action: LoadingAction,
  detail?: string,
  reported = true,
): void {
  if (!byId('loading-screen')) return
  // A projection hides the loading page's content (index.html) so it starts
  // plain black; a failed start shows there too, never as a black screen (T-138).
  const content = byId('loading-content')
  if (content) content.style.display = 'flex'
  const spinner = byId('loading-spinner')
  if (spinner) spinner.style.display = 'none'
  renderProgress(null)
  updateLoadingMessage(message)
  updateLoadingHint(hint)

  const detailEl = ensureChild(
    'loading-detail',
    'div',
    'margin:0;color:#6b7280;font-size:12px;line-height:1.5;max-width:340px;word-break:break-word;',
  )
  detailEl.textContent = detail ?? ''

  const button = ensureChild(
    'loading-retry',
    'button',
    'margin-top:16px;padding:10px 20px;border:none;border-radius:8px;background:#0070dd;color:#fff;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;',
  ) as HTMLButtonElement
  button.textContent = action.label
  button.disabled = false
  button.style.opacity = ''
  button.style.cursor = 'pointer'

  // Startup failures are always reported, so the operator has nothing else to do.
  const reportedEl = ensureChild(
    'loading-reported',
    'div',
    'margin-top:8px;color:#4b5563;font-size:11px;line-height:1.5;',
  )
  reportedEl.textContent = reported ? startupText('reported') : ''

  button.onclick = () => {
    button.disabled = true
    button.style.opacity = '0.6'
    button.style.cursor = 'wait'
    if (spinner) spinner.style.display = ''
    updateLoadingHint('')
    detailEl.textContent = ''
    reportedEl.textContent = ''
    action.onClick()
  }
}

export function hideLoadingScreen() {
  const loadingEl = byId('loading-screen')
  if (loadingEl) {
    // The app is live under it while it fades: let clicks and drags through.
    loadingEl.style.pointerEvents = 'none'
    loadingEl.style.opacity = '0'
    loadingEl.style.transition = 'opacity 0.3s ease-out'
    setTimeout(() => loadingEl.remove(), 300)
  }
}
