#!/usr/bin/env node
// PostToolUse hook: surface effect-arch lint diagnostics for a just-edited file.
//
// Design choices (see the enforcement plugin README):
//  - Cross-platform Node, not bash — parses the PostToolUse JSON from stdin
//    without `jq`, so it runs on Windows too.
//  - REPORT-ONLY. It never runs `--fix`: auto-rewriting a file the agent just
//    wrote staleness-races the agent's in-memory copy and breaks the next Edit.
//    It reports; the model decides.
//  - OPT-IN. It no-ops unless the repo has the enforcement kit wired
//    (a .claude/effect-arch.json sentinel, or eslint-config-effect-arch in
//    package.json). So installing this plugin globally is harmless in repos
//    that never opted in.
//  - NEVER blocks the edit. Any error → exit 0.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function readStdin() {
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

function safeExit() {
  process.exit(0)
}

let payload
try {
  payload = JSON.parse(readStdin() || '{}')
} catch {
  safeExit()
}

const filePath = payload?.tool_input?.file_path
const cwd = payload?.cwd || process.cwd()
if (!filePath) safeExit()

// Only TypeScript source under a src/ tree.
const isSrcTs = /(^|\/)src\/.*\.(ts|tsx)$/.test(filePath.replace(/\\/g, '/'))
if (!isSrcTs) safeExit()

// Opt-in guard: is the enforcement kit wired in this repo?
function kitPresent() {
  if (existsSync(join(cwd, '.claude', 'effect-arch.json'))) return true
  const pkgPath = join(cwd, 'package.json')
  if (!existsSync(pkgPath)) return false
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    return Boolean(deps['eslint-config-effect-arch'] || deps['eslint-plugin-effect-arch'])
  } catch {
    return false
  }
}
if (!kitPresent()) safeExit()

// Resolve the repo's local eslint. If absent, no-op (kit not fully installed).
const eslintBin = join(cwd, 'node_modules', '.bin', process.platform === 'win32' ? 'eslint.cmd' : 'eslint')
if (!existsSync(eslintBin)) safeExit()

const res = spawnSync(eslintBin, ['--format', 'json', filePath], {
  cwd,
  encoding: 'utf8',
  timeout: 20000,
})
if (res.error || !res.stdout) safeExit()

let report
try {
  report = JSON.parse(res.stdout)
} catch {
  safeExit()
}

const messages = (report[0]?.messages || []).filter((m) => m.ruleId && m.ruleId.startsWith('effect-arch/'))
if (messages.length === 0) safeExit()

const lines = messages.map((m) => `  ${filePath}:${m.line}:${m.column}  ${m.ruleId}  ${m.message}`)
const context = [
  `effect-arch: ${messages.length} architecture lint issue(s) in the file you just edited.`,
  ...lines,
  'These are design issues — fix the code, do not add eslint-disable. See the effect-arch:architecture skill.',
].join('\n')

// Surface to the model as additional context; do not block.
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: context,
    },
  }),
)
process.exit(0)
