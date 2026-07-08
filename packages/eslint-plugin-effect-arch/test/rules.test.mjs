import { test } from 'node:test'
import { RuleTester } from 'eslint'
import plugin from '../index.js'

// Run RuleTester inline under node:test (no mocha globals available).
RuleTester.describe = (_text, fn) => fn()
RuleTester.it = (_text, fn) => fn()
RuleTester.itOnly = (_text, fn) => fn()

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
})

const cases = {
  'no-bare-fetch': {
    valid: ['const r = http.get("/api/orders")', 'const f = obj.fetch()'],
    invalid: ['const r = fetch("/api/orders")'],
  },
  'no-new-promise': {
    valid: ['Effect.async((resume) => resume(Effect.void))'],
    invalid: ['const p = new Promise((res) => res(1))'],
  },
  'no-module-scope-service': {
    valid: [
      'function make() { const repo = new OrderRepo() ; return repo }',
      'const now = new Date()',
    ],
    invalid: ['const repo = new OrderRepo()', 'const client = new ApiClient()'],
  },
  'no-managed-runtime-make': {
    valid: ['const rt = runtimeRef.current', 'ManagedRuntime.dispose(rt)'],
    invalid: ['const rt = ManagedRuntime.make(AppLayer)'],
  },
  'no-throw-in-core': {
    valid: ['const e = Effect.fail(new NotFoundError({ id }))'],
    invalid: ['throw new Error("boom")'],
  },
  'no-real-timers-in-tests': {
    valid: ['const later = TestClock.adjust("100 millis")'],
    invalid: ['setTimeout(() => done(), 1000)', 'setInterval(tick, 500)'],
  },
  'no-run-sync-in-components': {
    valid: ['Effect.runPromise(program)', 'Effect.runFork(program)'],
    invalid: ['const v = Effect.runSync(program)'],
  },
}

for (const [id, { valid, invalid }] of Object.entries(cases)) {
  test(`rule: effect-arch/${id}`, () => {
    const rule = plugin.rules[id]
    if (!rule) throw new Error(`rule ${id} not exported by the plugin`)
    ruleTester.run(id, rule, {
      valid,
      invalid: invalid.map((code) => ({ code, errors: [{ messageId: 'violation' }] })),
    })
  })
}

test('every catalog rule is exported and tested', () => {
  const exported = Object.keys(plugin.rules).sort()
  const tested = Object.keys(cases).sort()
  if (exported.join(',') !== tested.join(',')) {
    throw new Error(
      `catalog/test mismatch:\n  exported: ${exported.join(', ')}\n  tested:   ${tested.join(', ')}`,
    )
  }
})
