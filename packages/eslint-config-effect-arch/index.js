// eslint-config-effect-arch
//
// `effectArch(options)` returns an array of ESLint flat-config objects that
// apply the effect-arch rules, scoped by layer role. Paths are configuration,
// never hardcoded — pass `layout` to match your repo. The runtime module gets
// an escape hatch for `ManagedRuntime.make`.
//
// Usage (eslint.config.mjs):
//   import { effectArch } from 'eslint-config-effect-arch'
//   export default [
//     // ...your base config (parser, plugins, etc.)...
//     ...effectArch({ runtimeFile: 'src/app/RuntimeContext.tsx' }),
//   ]

const plugin = require('eslint-plugin-effect-arch')

const defaultLayout = {
  // Every source file: the always-on I/O + DI + runtime rules.
  src: ['src/**/*.{ts,tsx}'],
  // Domain + application: additionally forbid `throw`.
  domainApplication: ['src/domain/**/*.{ts,tsx}', 'src/application/**/*.{ts,tsx}'],
  // Components: additionally forbid `Effect.runSync`.
  components: ['src/react/components/**/*.{ts,tsx}', 'src/react/ui/**/*.{ts,tsx}'],
  // Tests: additionally forbid real timers.
  tests: ['**/*.test.{ts,tsx}'],
  // The one file where `ManagedRuntime.make` is allowed.
  runtimeFile: 'src/app/RuntimeContext.tsx',
}

const GROUPS = {
  src: ['no-bare-fetch', 'no-new-promise', 'no-module-scope-service', 'no-managed-runtime-make'],
  domainApplication: ['no-throw-in-core'],
  components: ['no-run-sync-in-components'],
  tests: ['no-real-timers-in-tests'],
}

function effectArch(options = {}) {
  const layout = { ...defaultLayout, ...(options.layout || {}) }
  const runtimeFile = options.runtimeFile || layout.runtimeFile
  const severity = options.severity || 'error'

  const rulesFor = (ids) =>
    Object.fromEntries(ids.map((id) => [`effect-arch/${id}`, severity]))

  const block = (name, files, ids) => ({
    name,
    files,
    plugins: { 'effect-arch': plugin },
    rules: rulesFor(ids),
  })

  return [
    block('effect-arch/base', layout.src, GROUPS.src),
    block('effect-arch/core', layout.domainApplication, GROUPS.domainApplication),
    block('effect-arch/components', layout.components, GROUPS.components),
    block('effect-arch/tests', layout.tests, GROUPS.tests),
    {
      // The runtime module is the one place ManagedRuntime.make is allowed.
      name: 'effect-arch/runtime-escape-hatch',
      files: [runtimeFile],
      plugins: { 'effect-arch': plugin },
      rules: { 'effect-arch/no-managed-runtime-make': 'off' },
    },
  ]
}

module.exports = { effectArch, defaultLayout }
module.exports.effectArch = effectArch
module.exports.default = effectArch
