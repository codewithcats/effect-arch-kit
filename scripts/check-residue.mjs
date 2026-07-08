#!/usr/bin/env node
// Residue gate: fail if any source-repo-specific token leaked into the public
// guidance content. Default-layout paths (src/app/, src/domain/, ...) are
// intentional and NOT forbidden — they are presented via a layout map. What is
// forbidden is anything specific to the repo this material was extracted from.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

// Scan the guidance surface: skills + commands markdown.
const scanDirs = [
  'plugins/effect-arch/skills',
  'plugins/effect-arch/commands',
  'plugins/effect-arch-enforcement/commands',
]

const forbidden = [
  { re: /tournament/i, why: 'source-repo domain term' },
  { re: /\bplayer\b/i, why: 'source-repo domain term' },
  { re: /registrationFee/, why: 'source-repo domain field' },
  { re: /playtime/i, why: 'source-repo name' },
  { re: /zephrix/i, why: 'source-repo design-system name' },
  { re: /\bADR-0\d\d?\b/, why: 'dangling ADR citation (inline the rationale instead)' },
  // A dangling ADR *link* — up-directory path or a numbered ADR file. A bare
  // mention of `docs/adr/` (telling the reader to check their own repo's ADRs)
  // is legitimate and NOT flagged.
  { re: /\.\.[\/\w-]*docs\/adr/, why: 'up-directory ADR link into the source repo' },
  { re: /docs\/adr\/\d/, why: 'link to a numbered ADR file in the source repo' },
  { re: /ESLint forbids/, why: 'dishonest enforcement claim (use the two-register wording)' },
  // Known source-repo issue/PR numbers. #3718 (upstream Effect bug) is fine;
  // generic placeholders like #123 or data like "Order #1001" are fine.
  { re: /#(373|386|402|555|556|557|558)\b/, why: 'source-repo issue/PR number' },
]

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
const violations = []

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    for (const { re, why } of forbidden) {
      if (re.test(line)) violations.push({ file, line: i + 1, text: line.trim(), why })
    }
  })
}

if (violations.length === 0) {
  console.log(`residue check: clean (${files.length} files scanned)`)
  process.exit(0)
}

console.error(`residue check: ${violations.length} violation(s)\n`)
for (const v of violations) {
  console.error(`  ${relative(root, v.file)}:${v.line} — ${v.why}`)
  console.error(`    ${v.text}`)
}
process.exit(1)
