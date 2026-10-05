#!/usr/bin/env node
/**
 * Points git at the repository's own hooks (.githooks: gitleaks on every
 * commit and push, no AI co-author lines). Run by `bun install`
 * (postinstall), so every clone gets them without a manual step.
 * Outside a git checkout (e.g. a source tarball) it does nothing.
 *
 * Cross-platform: execFileSync with an argument array, no shell.
 */

const { execFileSync } = require('node:child_process')

function git(args) {
  return execFileSync('git', args, { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim()
}

try {
  git(['rev-parse', '--is-inside-work-tree'])
} catch {
  process.exit(0)
}

git(['config', 'core.hooksPath', '.githooks'])
console.log('git hooks: core.hooksPath = .githooks (gitleaks on commit and push)')
