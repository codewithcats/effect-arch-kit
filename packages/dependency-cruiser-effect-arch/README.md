# dependency-cruiser-effect-arch

A [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) config factory enforcing the effect-arch layered architecture on the **full import graph** — the transitive check ESLint's per-file boundaries can't do — plus `no-circular`.

## Layer rules

```
domain          → nothing (only other domain or external libs)
application     → domain only
infrastructure  → domain only
react           → domain, application (NOT infrastructure)
lib             → helpers; domain/application must not import it
app             → unconstrained (composition root)
```

## Usage

```js
// .dependency-cruiser.cjs
const { effectArchDepcruise } = require('dependency-cruiser-effect-arch')

module.exports = effectArchDepcruise({ tsConfig: 'tsconfig.json' })
```

Then:

```bash
npx depcruise --config .dependency-cruiser.cjs src
```

### Options

| Option | Default | Purpose |
| --- | --- | --- |
| `layers` | default layer regexes | Override the path regex for each layer (`domain`, `application`, `infrastructure`, `react`, `app`, `lib`) |
| `tsConfig` | `tsconfig.json` | tsconfig for path resolution (e.g. `tsconfig.app.json`) |
| `includeOnly` | `^src/` | Restrict the crawl |
