#!/usr/bin/env node
// Conformance gate: every `effect-arch/<id>` a skill or command cites must be a
// real rule in the eslint-plugin-effect-arch catalog. This is what keeps the
// two-register wording honest — a skill can never promise a lint id that the
// enforcement kit doesn't actually ship.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import catalog from '../packages/eslint-plugin-effect-arch/rules-catalog.js'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const known = new Set(catalog.map((r) => r.id))

const scanDirs = ['plugins/effect-arch/skills', 'plugins/effect-arch/commands']
const idRef = /effect-arch\/([a-z][a-z0-9-]+)/g

function walk(dir) {
  const abs = join(root, dir)
  let out = []
  let entries
  try {
    entries = readdirSync(abs)
  } catch {
    return out
  }
  for (const e of entries) {
    const p = join(abs, e)
    if (statSync(p).isDirectory()) out = out.concat(walk(relative(root, p)))
    else if (e.endsWith('.md')) out.push(p)
  }
  return out
}

const files = scanDirs.flatMap(walk)
const unknown = []
const cited = new Set()

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    let m
    idRef.lastIndex = 0
    while ((m = idRef.exec(line)) !== null) {
      cited.add(m[1])
      if (!known.has(m[1])) unknown.push({ file, line: i + 1, id: m[1] })
    }
  })
}

if (unknown.length > 0) {
  console.error(`skill rule-id check: ${unknown.length} unknown id(s)\n`)
  for (const u of unknown) {
    console.error(`  ${relative(root, u.file)}:${u.line} — effect-arch/${u.id} is not in the catalog`)
  }
  console.error(`\nKnown ids: ${[...known].join(', ')}`)
  process.exit(1)
}

console.log(
  `skill rule-id check: clean (${cited.size} distinct ids cited, all in the catalog of ${known.size})`,
)
