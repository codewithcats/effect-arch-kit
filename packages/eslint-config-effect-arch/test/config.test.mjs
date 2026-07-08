import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ESLint } from 'eslint'
import { effectArch } from '../index.js'

const here = dirname(fileURLToPath(import.meta.url))
const fixtures = join(here, 'fixtures')

// The consuming repo supplies parser/languageOptions; the fixtures are plain JS
// so espree suffices. Prepend a languageOptions block, then the factory output.
const config = [
  { languageOptions: { ecmaVersion: 2022, sourceType: 'module' } },
  ...effectArch(),
]

async function ruleIds(relPath) {
  const eslint = new ESLint({
    cwd: fixtures,
    overrideConfigFile: true,
    overrideConfig: config,
  })
  const [result] = await eslint.lintFiles([relPath])
  return result.messages.map((m) => m.ruleId).sort()
}

const expectations = {
  'src/infrastructure/bad-fetch.ts': ['effect-arch/no-bare-fetch'],
  'src/domain/bad-throw.ts': ['effect-arch/no-throw-in-core'],
  'src/react/components/bad-runsync.ts': ['effect-arch/no-run-sync-in-components'],
  'src/foo.test.ts': ['effect-arch/no-real-timers-in-tests'],
  'src/other/bad-runtime.ts': ['effect-arch/no-managed-runtime-make'],
  // Escape hatch: ManagedRuntime.make is allowed in the runtime module.
  'src/app/RuntimeContext.tsx': [],
  'src/application/good.ts': [],
}

for (const [file, expected] of Object.entries(expectations)) {
  test(`config scopes rules correctly: ${file}`, async () => {
    assert.deepEqual(await ruleIds(file), expected)
  })
}
