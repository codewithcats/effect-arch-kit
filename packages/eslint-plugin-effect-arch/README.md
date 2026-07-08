# eslint-plugin-effect-arch

Real, named ESLint rules for a layered Effect-TS architecture. Because the ids are real (not `no-restricted-syntax` message prefixes), they're greppable, individually configurable, and `// eslint-disable-next-line effect-arch/<id>` works. The effect-arch skills cite these exact ids.

## Rules

| Rule | Flags | Applied to (via the config factory) |
| --- | --- | --- |
| `effect-arch/no-bare-fetch` | `fetch(...)` | all source |
| `effect-arch/no-new-promise` | `new Promise(...)` | all source |
| `effect-arch/no-module-scope-service` | `const x = new *Service/Client/Repo()` at module scope | all source |
| `effect-arch/no-managed-runtime-make` | `ManagedRuntime.make(...)` outside the runtime module | all source (escape hatch for the runtime file) |
| `effect-arch/no-throw-in-core` | `throw` | domain + application |
| `effect-arch/no-real-timers-in-tests` | `setTimeout` / `setInterval` / `setImmediate` | tests |
| `effect-arch/no-run-sync-in-components` | `Effect.runSync(...)` | components |

## Usage

Prefer the config factory in [`eslint-config-effect-arch`](../eslint-config-effect-arch) — it registers the plugin and scopes each rule to the right layer role. To wire rules by hand:

```js
import effectArch from 'eslint-plugin-effect-arch'

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'effect-arch': effectArch },
    rules: { 'effect-arch/no-bare-fetch': 'error' },
  },
]
```

The rule catalog (`rules-catalog.js`) is the single source of truth for ids, selectors, and messages.
