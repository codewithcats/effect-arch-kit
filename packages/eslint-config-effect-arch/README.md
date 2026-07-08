# eslint-config-effect-arch

Flat-config factory that applies the [`eslint-plugin-effect-arch`](../eslint-plugin-effect-arch) rules, scoped by layer role, with a layout-driven escape hatch for the runtime module. Ships the `effect-arch-init` codemod.

## Usage

```js
// eslint.config.mjs
import { effectArch } from 'eslint-config-effect-arch'

export default [
  // ...your base config (parser, react, etc.)...
  ...effectArch({ runtimeFile: 'src/app/RuntimeContext.tsx' }),
]
```

### Options

| Option | Default | Purpose |
| --- | --- | --- |
| `runtimeFile` | `src/app/RuntimeContext.tsx` | The one file where `ManagedRuntime.make` is allowed |
| `layout` | default layout | Override the globs for each role (`src`, `domainApplication`, `components`, `tests`) |
| `severity` | `error` | Rule severity |

Example for a non-default layout:

```js
effectArch({
  runtimeFile: 'app/runtime.ts',
  layout: {
    src: ['app/**/*.{ts,tsx}'],
    domainApplication: ['app/core/**/*.{ts,tsx}', 'app/usecases/**/*.{ts,tsx}'],
    components: ['app/ui/**/*.{ts,tsx}'],
    tests: ['**/*.test.{ts,tsx}'],
  },
})
```

## The `effect-arch-init` codemod

```
effect-arch-init                 # dry-run: print the plan
effect-arch-init --write         # write fragments + sentinel, patch package.json
effect-arch-init --write --link /path/to/effect-arch-kit   # file: deps before npm publish
effect-arch-init eject           # undo everything init wrote
```

It writes importable fragments (never splices your existing config) and records everything in `.claude/effect-arch.json` so `eject` is exact.
