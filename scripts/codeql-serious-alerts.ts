// Lists the CodeQL alerts that block a release, from the SARIF files
// security-check.sh writes, and exits 1 when there is any: error- or
// warning-level results, or a rule rated high/critical security severity
// (>= 7.0, what CI's "No serious CodeQL alert" gate refuses). Alerts listed
// in .codeql-accepted.txt (rule id and path, after a review) are skipped.
//
// Usage: bun scripts/codeql-serious-alerts.ts <file.sarif>...

type Rule = {
  id: string
  defaultConfiguration?: { level?: string }
  properties?: Record<string, unknown>
}
type Result = {
  ruleId?: string
  rule?: { index?: number }
  ruleIndex?: number
  level?: string
  message: { text: string }
  locations?: {
    physicalLocation?: {
      artifactLocation?: { uri?: string }
      region?: { startLine?: number }
    }
  }[]
}
type Sarif = {
  runs: { tool: { driver: { rules?: Rule[] } }; results?: Result[] }[]
}

const files = process.argv.slice(2)
if (files.length === 0)
  throw new Error('usage: bun scripts/codeql-serious-alerts.ts <file.sarif>...')

const acceptedFile = `${import.meta.dir}/../.codeql-accepted.txt`
const accepted = new Set(
  (await Bun.file(acceptedFile).text())
    .split('\n')
    .map((line) => line.replace(/#.*/, '').trim().split(/\s+/).join(' '))
    .filter(Boolean),
)

const serious: string[] = []
let skipped = 0
let total = 0
for (const file of files) {
  const sarif = (await Bun.file(file).json()) as Sarif
  for (const run of sarif.runs) {
    const rules = run.tool.driver.rules ?? []
    for (const result of run.results ?? []) {
      total++
      const rule =
        rules[result.rule?.index ?? result.ruleIndex ?? -1] ??
        rules.find((r) => r.id === result.ruleId)
      const level =
        result.level ?? rule?.defaultConfiguration?.level ?? 'warning'
      const securitySeverity = Number(
        rule?.properties?.['security-severity'] ?? 0,
      )
      if (level !== 'error' && level !== 'warning' && securitySeverity < 7)
        continue
      const where = result.locations?.[0]?.physicalLocation
      const ruleId = result.ruleId ?? rule?.id
      if (accepted.has(`${ruleId} ${where?.artifactLocation?.uri}`)) {
        skipped++
        continue
      }
      serious.push(
        `${level} ${ruleId} ${where?.artifactLocation?.uri}:${where?.region?.startLine ?? '?'}  ${result.message.text.split('\n')[0]}`,
      )
    }
  }
}

if (serious.length > 0) {
  console.error(`error: ${serious.length} CodeQL alert(s) block the release:`)
  for (const line of serious) console.error(`  ${line}`)
  process.exit(1)
}
console.log(
  `CodeQL: no error or warning alert (${total} result(s), ${skipped} accepted in .codeql-accepted.txt).`,
)
