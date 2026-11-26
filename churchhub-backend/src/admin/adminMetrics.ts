/** Admin sign-ins by outcome, since this process started. */
const signIns = { success: 0, failure: 0 }

export function countAdminSignIn(result: keyof typeof signIns): void {
  signIns[result] += 1
}

/**
 * The admin listener's Prometheus metrics (text format 0.0.4). Labels stay
 * low-cardinality: the outcome only, never an email or an address. Each
 * replica counts its own; Prometheus sums them.
 */
export function renderAdminMetrics(): string {
  return [
    '# HELP churchhub_admin_signin_total Admin panel sign-ins by result.',
    '# TYPE churchhub_admin_signin_total counter',
    `churchhub_admin_signin_total{result="success"} ${signIns.success}`,
    `churchhub_admin_signin_total{result="failure"} ${signIns.failure}`,
    '',
  ].join('\n')
}
