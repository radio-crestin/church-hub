import { QUERIES } from './queries'
import type { BenchMessage, BenchRequest } from './worker/bench.worker'

const steps = document.querySelector('#steps') as HTMLTableSectionElement
const status = document.querySelector('#status') as HTMLDivElement
const raw = document.querySelector('#raw') as HTMLPreElement
const buttons = [...document.querySelectorAll<HTMLButtonElement>('button')]

function formatDetail(detail: unknown): string {
  if (!detail || typeof detail !== 'object') return ''
  return Object.entries(detail)
    .filter(([, value]) => typeof value !== 'object')
    .map(([key, value]) => `${key} ${value}`)
    .join(', ')
}

function addStep(name: string, ms: number, detail?: unknown): void {
  const row = steps.insertRow()
  row.insertCell().textContent = `${name} ${formatDetail(detail)}`
  row.insertCell().textContent = `${ms.toLocaleString()} ms`
}

async function saveResults(results: Record<string, unknown>): Promise<void> {
  const response = await fetch('./results', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(results),
  }).catch(() => null)
  status.textContent += response?.ok
    ? ' Results saved.'
    : ' (results not saved)'
}

function run(
  request: BenchRequest,
  label: string,
): Promise<Record<string, unknown>> {
  steps.replaceChildren()
  raw.textContent = ''
  status.textContent = `Running: ${label}…`
  buttons.forEach((button) => (button.disabled = true))
  const started = performance.now()
  const worker = new Worker(
    new URL('./worker/bench.worker.ts', import.meta.url),
    {
      type: 'module',
    },
  )
  return new Promise((resolve) => {
    // A worker module that fails to load or evaluate only fires `error`.
    worker.onerror = (event) => {
      event.preventDefault()
      worker.onmessage?.(
        new MessageEvent('message', {
          data: {
            type: 'error',
            message: `worker failed to start: ${event.message || 'unknown error'} (${event.filename}:${event.lineno})`,
            results: {},
          } satisfies BenchMessage,
        }),
      )
    }
    worker.onmessage = async (event: MessageEvent<BenchMessage>) => {
      const message = event.data
      if (message.type === 'step')
        return addStep(message.name, message.ms, message.detail)
      const results = {
        ...message.results,
        label,
        totalMs: Math.round(performance.now() - started),
        ...(message.type === 'error'
          ? { error: message.message, stack: message.stack }
          : {}),
      }
      status.textContent =
        message.type === 'error'
          ? `Failed: ${message.message}`
          : `Done in ${results.totalMs} ms.`
      raw.textContent = JSON.stringify(results, null, 2)
      worker.terminate()
      buttons.forEach((button) => (button.disabled = false))
      ;(window as { benchResults?: unknown }).benchResults = results
      await saveResults(results)
      resolve(results)
    }
    worker.postMessage(request)
  })
}

for (const button of buttons) {
  button.addEventListener('click', () => {
    const snapshot = button.dataset.snapshot ?? null
    void run(
      {
        snapshotUrl: snapshot
          ? new URL(`./snapshots/${snapshot}`, location.href).href
          : null,
        wipe: button.dataset.wipe === '1',
        queries: QUERIES,
      },
      button.textContent ?? '',
    )
  })
}

// ?snapshot=snapshot-3000.json.gz runs straight away (the Playwright check).
const params = new URLSearchParams(location.search)
const auto = params.get('snapshot')
if (auto !== null) {
  void run(
    {
      snapshotUrl: auto
        ? new URL(`./snapshots/${auto}`, location.href).href
        : null,
      wipe: params.get('wipe') !== '0',
      queries: QUERIES,
      pragmas: params.getAll('pragma'),
      mode: (params.get('mode') ?? undefined) as BenchRequest['mode'],
    },
    auto || 'reopen',
  )
}
