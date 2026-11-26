/**
 * The admin panel's page: one static document (styles and script under a
 * per-response CSP nonce) that reads and changes everything through
 * /admin/api. Colours are DESIGN.md's tokens in both themes; every value
 * from the API is written with textContent, never as HTML.
 */
export function adminPage(nonce: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cloud backup admin</title>
<style nonce="${nonce}">
:root{--app:#f1f1f1;--panel:#fff;--field:#f1f1f1;--selected:#e6e6e6;--hover:#ececec;--line:#e3e3e3;--line-strong:#ccc;--fg:#111;--body:#222;--label:#444;--hint:#5e5e5e;--primary:#0070dd;--focus:#0070dd;--ok:#1f9d55;--shadow:0 12px 32px rgba(0,0,0,.12)}
@media (prefers-color-scheme:dark){:root{--app:#111;--panel:#161616;--field:#232323;--selected:#2b2b2b;--hover:#262626;--line:#262626;--line-strong:#3d3d3d;--fg:#fff;--body:#e6e6e6;--label:#a6a6a6;--hint:#999;--focus:#0099ff;--ok:#30d158;--shadow:0 12px 32px rgba(0,0,0,.55)}}
*{box-sizing:border-box}
body{margin:0;background:var(--app);color:var(--body);font:14px/20px Inter,system-ui,sans-serif}
header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line)}
h1{margin:0;font-size:18px;line-height:28px;font-weight:600;color:var(--fg)}
h2{margin:0 0 8px;font-size:16px;line-height:24px;font-weight:600;color:var(--fg)}
main{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:12px;padding:16px;max-width:1360px;margin:0 auto}
@media (max-width:900px){main{grid-template-columns:1fr}}
section{min-width:0;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px}
.hint{color:var(--hint);font-size:12px;line-height:16px}
.tabs{display:inline-flex;gap:4px;padding:4px;border-radius:8px;background:var(--field)}
button,input{font:inherit}
button{height:32px;padding:0 12px;border:0;border-radius:8px;background:var(--field);color:var(--fg);cursor:pointer}
button:hover{background:var(--hover)}
button.primary{background:var(--primary);color:#fff}
button.outline{background:transparent;box-shadow:inset 0 0 0 1px var(--line-strong)}
button[aria-pressed=true]{background:var(--selected)}
button:disabled{opacity:.5;cursor:not-allowed}
:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
input{height:32px;padding:0 10px;border:0;border-radius:10px;background:var(--field);color:var(--fg);min-width:0}
input:focus{outline:1px solid var(--focus);outline-offset:-1px}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-weight:500;color:var(--label);font-size:12px;padding:6px 8px;border-bottom:1px solid var(--line)}
td{padding:8px;border-bottom:1px solid var(--line);vertical-align:middle;font-variant-numeric:tabular-nums}
tbody tr{cursor:pointer}
tbody tr:hover{background:var(--hover)}
tbody tr[aria-selected=true]{background:var(--selected)}
.bar{height:6px;border-radius:3px;background:var(--field);overflow:hidden;margin-top:4px;min-width:120px}
.bar>span{display:block;height:100%;background:var(--label)}
.status{display:inline-flex;align-items:center;gap:6px}
.dot{width:6px;height:6px;border-radius:50%;background:var(--ok)}
.dot.paused{background:var(--hint)}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}
dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:0 0 12px}
dt{color:var(--hint)}dd{margin:0;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.list{max-height:240px;overflow:auto}
.message{min-height:16px;margin-top:8px}
[hidden]{display:none!important}
.spread{justify-content:space-between}.scroll{overflow-x:auto}.narrow{width:96px}.gap-top{margin-top:12px}
</style>
</head>
<body>
<header>
  <h1>Cloud backup admin</h1>
  <div class="row" id="who" hidden><span class="hint" id="adminEmail"></span><button class="outline" id="signOut">Sign out</button></div>
</header>
<main id="signedOut" hidden>
  <section><h2>Sign in</h2><p class="hint">Only allowlisted Google accounts can use this panel.</p><a href="/admin/sign-in"><button class="primary" type="button">Sign in with Google</button></a></section>
</main>
<main id="app" hidden>
  <section>
    <div class="row spread">
      <div class="tabs" role="tablist">
        <button type="button" id="tabAccounts" aria-pressed="true">Accounts</button>
        <button type="button" id="tabAudit" aria-pressed="false">Audit log</button>
      </div>
      <input id="search" type="search" placeholder="Search by email" aria-label="Search by email">
    </div>
    <div id="accountsView">
      <div class="scroll"><table><thead><tr><th>Email</th><th>Usage</th><th>Last backup</th><th>Status</th></tr></thead><tbody id="accounts"></tbody></table></div>
      <div class="row"><button type="button" id="prev">Previous</button><span class="hint" id="pageInfo"></span><button type="button" id="next">Next</button></div>
    </div>
    <div id="auditView" hidden>
      <div class="scroll"><table><thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Change</th><th>Status</th></tr></thead><tbody id="audit"></tbody></table></div>
    </div>
  </section>
  <section id="detail">
    <p class="hint" id="detailEmpty">Pick an account to see its backups and change its quota.</p>
    <div id="detailBody" hidden>
      <h2 id="dEmail"></h2>
      <dl id="dFacts"></dl>
      <h2>Quota</h2>
      <div class="row"><input id="quotaGb" type="number" min="0" max="50" step="0.5" aria-label="Quota in GB" class="narrow"><span class="hint">GB</span><button type="button" class="primary" id="saveQuota">Save</button><button type="button" id="defaultQuota">Use default</button></div>
      <div class="row"><button type="button" id="suspend"></button><button type="button" id="reconcile">Reconcile usage</button></div>
      <h2>Backups</h2>
      <div class="list"><table><tbody id="dBackups"></tbody></table></div>
      <h2 class="gap-top">Delete account</h2>
      <p class="hint">Deletes every backup and signs the account out everywhere. Type the account’s email to confirm.</p>
      <div class="row"><input id="confirmDelete" aria-label="Email to confirm"><button type="button" id="deleteAccount">Delete</button></div>
      <p class="hint message" id="message" role="status"></p>
    </div>
  </section>
</main>
<script nonce="${nonce}">
const GB = 1024 ** 3
const $ = (id) => document.getElementById(id)
let csrf = '', page = 1, total = 0, pageSize = 25, current = null

const size = (bytes) => bytes >= GB ? (bytes / GB).toFixed(1) + ' GB' : bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB'
const when = (ms) => ms ? new Date(ms).toLocaleString() : 'Never'
const cell = (text) => { const td = document.createElement('td'); td.textContent = text; return td }

async function api(path, options = {}) {
  const response = await fetch('/admin/api' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, ...(options.headers || {}) },
    credentials: 'same-origin',
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || ('HTTP ' + response.status))
  return body
}

function usageCell(account) {
  const td = cell(size(account.usedBytes) + ' of ' + size(account.quotaBytes))
  const bar = document.createElement('div'); bar.className = 'bar'
  const fill = document.createElement('span')
  fill.style.width = Math.min(100, account.quotaBytes ? (100 * account.usedBytes) / account.quotaBytes : 100) + '%'
  bar.append(fill); td.append(bar); return td
}

function statusCell(account) {
  const td = document.createElement('td'); const wrap = document.createElement('span'); wrap.className = 'status'
  const dot = document.createElement('span'); dot.className = account.suspended ? 'dot paused' : 'dot'
  wrap.append(dot, document.createTextNode(account.suspended ? 'Paused' : 'Active')); td.append(wrap); return td
}

async function loadAccounts() {
  const query = encodeURIComponent($('search').value)
  const data = await api('/accounts?query=' + query + '&page=' + page)
  total = data.total; pageSize = data.pageSize
  const rows = data.accounts.map((account) => {
    const tr = document.createElement('tr'); tr.tabIndex = 0
    tr.setAttribute('aria-selected', String(current === account.id))
    tr.append(cell(account.email || '(deleted)'), usageCell(account), cell(when(account.lastBackupAt)), statusCell(account))
    tr.addEventListener('click', () => openAccount(account.id))
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') openAccount(account.id) })
    return tr
  })
  $('accounts').replaceChildren(...rows)
  const pages = Math.max(1, Math.ceil(total / pageSize))
  $('pageInfo').textContent = 'Page ' + page + ' of ' + pages + ' · ' + total + ' accounts'
  $('prev').disabled = page <= 1; $('next').disabled = page >= pages
}

async function openAccount(id) {
  current = id
  const a = await api('/accounts/' + id)
  $('detailEmpty').hidden = true; $('detailBody').hidden = false
  $('dEmail').textContent = a.email || '(deleted)'
  const facts = [
    ['Usage', size(a.usedBytes) + ' of ' + size(a.quotaBytes) + (a.quotaOverride === null ? ' (default)' : ' (custom)')],
    ['Uploading', size(a.reservedBytes)], ['Backups', String(a.backupCount)], ['Signed-in PCs', String(a.sessions)],
    ['Created', when(a.createdAt)], ['Last sign-in', when(a.lastSignInAt)], ['Last backup', when(a.lastBackupAt)],
    ['Last reconcile', when(a.lastReconciledAt)], ['Account id', a.id],
  ]
  $('dFacts').replaceChildren(...facts.flatMap(([k, v]) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; return [dt, dd] }))
  $('quotaGb').value = String(Math.round((a.quotaBytes / GB) * 10) / 10)
  $('suspend').textContent = a.suspended ? 'Resume uploads' : 'Pause uploads'
  $('suspend').dataset.next = String(!a.suspended)
  $('dBackups').replaceChildren(...a.backups.map((b) => { const tr = document.createElement('tr'); tr.append(cell(when(b.createdAt)), cell(size(b.sizeBytes)), cell(b.appVersion)); return tr }))
  $('confirmDelete').value = ''; $('message').textContent = ''
  loadAccounts()
}

async function act(work, done) {
  $('message').textContent = ''
  try { await work(); $('message').textContent = done; await openAccount(current) }
  catch (error) { $('message').textContent = error.message }
}

async function loadAudit() {
  const { entries } = await api('/audit?limit=200')
  $('audit').replaceChildren(...entries.map((e) => {
    const tr = document.createElement('tr')
    const change = e.before !== undefined || e.after !== undefined ? JSON.stringify(e.before ?? null) + ' → ' + JSON.stringify(e.after ?? null) : ''
    tr.append(cell(when(e.at)), cell(e.admin || '(not signed in)'), cell(e.action + (e.target ? ' · ' + e.target.slice(0, 10) : '')), cell(change), cell(String(e.status)))
    return tr
  }))
}

function showTab(audit) {
  $('tabAccounts').setAttribute('aria-pressed', String(!audit)); $('tabAudit').setAttribute('aria-pressed', String(audit))
  $('accountsView').hidden = audit; $('auditView').hidden = !audit; $('search').hidden = audit
  if (audit) loadAudit()
}

$('tabAccounts').onclick = () => showTab(false)
$('tabAudit').onclick = () => showTab(true)
$('prev').onclick = () => { page--; loadAccounts() }
$('next').onclick = () => { page++; loadAccounts() }
let searchTimer
$('search').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { page = 1; loadAccounts() }, 250) }
$('saveQuota').onclick = () => act(() => api('/accounts/' + current + '/quota', { method: 'PUT', body: JSON.stringify({ quotaBytes: Math.round(Number($('quotaGb').value) * GB) }) }), 'Quota saved')
$('defaultQuota').onclick = () => act(() => api('/accounts/' + current + '/quota', { method: 'PUT', body: JSON.stringify({ quotaBytes: null }) }), 'Back to the default quota')
$('suspend').onclick = () => act(() => api('/accounts/' + current + '/suspended', { method: 'PUT', body: JSON.stringify({ suspended: $('suspend').dataset.next === 'true' }) }), 'Saved')
$('reconcile').onclick = () => act(() => api('/accounts/' + current + '/reconcile', { method: 'POST', body: '{}' }), 'Usage recomputed')
$('deleteAccount').onclick = async () => {
  try {
    await api('/accounts/' + current, { method: 'DELETE', body: JSON.stringify({ confirm: $('confirmDelete').value.trim() }) })
    current = null; $('detailBody').hidden = true; $('detailEmpty').hidden = false; loadAccounts()
  } catch (error) { $('message').textContent = error.message }
}
$('signOut').onclick = async () => { await api('/sign-out', { method: 'POST', body: '{}' }).catch(() => {}); location.reload() }

api('/session').then((session) => {
  csrf = session.csrfToken
  $('adminEmail').textContent = session.email; $('who').hidden = false; $('app').hidden = false
  loadAccounts()
}).catch(() => { $('signedOut').hidden = false })
</script>
</body>
</html>`
}
