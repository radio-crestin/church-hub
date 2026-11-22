#!/usr/bin/env bun
/**
 * Release notes written by Claude, run by the release CI (build-release.yml,
 * create-release job) for the version just tagged.
 *
 * Reads the commits since the previous version tag (subjects and bodies),
 * asks Claude for plain-language notes in English and Romanian (new features
 * and fixes, for the people running the app on a Sunday, not for developers)
 * and writes the release body's notes section: readable on the GitHub release
 * page, plus the same notes as JSON in an HTML comment, which the app reads
 * (Settings > About, the update page) and save-written-notes.ts bundles.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=… bun app/scripts/write-release-notes.ts 0.1.105 --out notes.md
 *
 * The key comes from the CI secret, never the repo. Without it, or when
 * Claude fails, the script exits 1 and the release keeps its commit list.
 *
 * Plain `fetch`, no SDK: the release job holds a write token and installs
 * nothing (build-release.yml keeps the dependency tree away from it).
 */

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { renderWrittenNotesBlock } from '../apps/client/src/features/release-notes/service/writtenNotesBlock'
import type {
  WrittenNotes,
  WrittenNotesInLanguage,
} from '../apps/client/src/features/release-notes/types'

const REPO_ROOT = join(import.meta.dir, '..', '..')
const MODEL = 'claude-opus-5-5'
// The API's address; a test points it at a stand-in.
const API_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'
const DEBUG = process.env.DEBUG === 'true'

function git(args: string[]): string {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
    maxBuffer: 64 * 1024 * 1024,
  }).trim()
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

/** The commits of `version`: since the tag before it, up to its tag (or HEAD before tagging). */
function commitsOf(version: string): string {
  const tag = `v${version}`
  const end = git(['tag', '--list', tag]) ? tag : 'HEAD'
  let range = end
  try {
    const previous = git([
      'describe',
      '--tags',
      '--abbrev=0',
      '--match',
      'v[0-9]*',
      end === 'HEAD' ? 'HEAD' : `${tag}^`,
    ])
    range = `${previous}..${end}`
  } catch {
    // No earlier version tag (a first release, or a shallow checkout).
    console.warn(`No version tag before ${end}: taking every commit up to it`)
  }
  const log = git(['log', '--no-merges', '--format=%s%n%n%b%n-----', range])
  if (!log) throw new Error(`No commits in ${range}`)
  return log
}

const LIST = { type: 'array', items: { type: 'string' } }
const LANGUAGE = {
  type: 'object',
  properties: { features: LIST, bugFixes: LIST },
  required: ['features', 'bugFixes'],
  additionalProperties: false,
}
const SCHEMA = {
  type: 'object',
  properties: { en: LANGUAGE, ro: LANGUAGE },
  required: ['en', 'ro'],
  additionalProperties: false,
}

const INSTRUCTIONS = `You write the release notes of Church Hub, a desktop app churches use to project song lyrics and Bible verses and to run their YouTube livestream. The people reading them are church volunteers at the projection desk, not developers.

From the commits below, list what changed for them, in English (en) and in Romanian (ro):
- features: what is new or works better, one short sentence each, saying what they can now do.
- bugFixes: what was wrong and now works, one short sentence each, saying what they will notice.

Leave out everything they never see: tests, CI, builds, refactors, developer tooling, review builds, agents, task IDs (T-123, CH-45), file and function names. Merge commits about the same change into one item. Most important first, at most 12 items per list; an empty list when there is nothing.

Romanian: natural church wording as a Romanian volunteer would say it (cântare, verset, program, ecran, transmisiune), correct diacritics with the comma below (ș, ț, never ş, ţ), no word-for-word translation from English.`

async function writeNotes(commits: string): Promise<WrittenNotes> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const response = await fetch(`${API_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2026-10-21',
      // A declined request is retried on Anthropic's recommended fallback model.
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      fallbacks: 'default',
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      system: INSTRUCTIONS,
      messages: [
        { role: 'user', content: `<commits>\n${commits}\n</commits>` },
      ],
    }),
    signal: AbortSignal.timeout(10 * 60_000),
  })
  if (!response.ok) {
    throw new Error(
      `Claude answered ${response.status}: ${await response.text()}`,
    )
  }
  const message = (await response.json()) as {
    stop_reason: string
    content: { type: string; text?: string }[]
  }
  if (message.stop_reason !== 'end_turn') {
    throw new Error(`Claude stopped early: ${message.stop_reason}`)
  }
  const text = message.content.find((block) => block.type === 'text')?.text
  if (!text) throw new Error('Claude returned no text')
  return JSON.parse(text) as WrittenNotes
}

function renderLanguage(
  heading: string,
  labels: [features: string, bugFixes: string],
  notes: WrittenNotesInLanguage,
): string[] {
  const lines = [`## ${heading}`, '']
  const lists: [string, string[]][] = [
    [labels[0], notes.features],
    [labels[1], notes.bugFixes],
  ]
  for (const [label, items] of lists) {
    if (!items.length) continue
    lines.push(`**${label}**`, '', ...items.map((item) => `- ${item}`), '')
  }
  return lines
}

/** The release body's notes section: both languages, then the block the app reads. */
function renderSection(notes: WrittenNotes): string {
  return [
    ...renderLanguage("What's new", ['New', 'Fixed'], notes.en),
    ...renderLanguage('Ce e nou', ['Noutăți', 'Corectări'], notes.ro),
    renderWrittenNotesBlock(notes),
    '',
  ].join('\n')
}

async function main() {
  const version = process.argv[2]?.replace(/^v/, '')
  const out = argument('--out')
  if (!version || !out) {
    throw new Error('usage: write-release-notes.ts <version> --out <file>')
  }
  const commits = commitsOf(version)
  if (DEBUG) console.log(commits)
  const notes = await writeNotes(commits)
  writeFileSync(out, renderSection(notes))
  console.log(
    `Wrote the v${version} notes to ${out}: ${notes.en.features.length} features, ${notes.en.bugFixes.length} fixes`,
  )
}

main().catch((error) => {
  console.error(
    `[write-release-notes] ${error instanceof Error ? error.message : error}`,
  )
  process.exit(1)
})
