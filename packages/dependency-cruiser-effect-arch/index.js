// dependency-cruiser-effect-arch
//
// `effectArchDepcruise(options)` builds a dependency-cruiser config enforcing
// the layered architecture on the full import graph (and catching cycles).
// This complements the ESLint rules: boundaries checks per-file imports in the
// editor; dependency-cruiser checks transitive graph + cycles in CI.
//
// Layer rules (composition root: app):
//   domain          → nothing (only other domain or external libs)
//   application     → domain only
//   infrastructure  → domain only
//   react           → domain, application (NOT infrastructure)
//   lib             → helpers; domain/application must not import it
//   app             → unconstrained (composition root)
//
// Usage (.dependency-cruiser.cjs):
//   const { effectArchDepcruise } = require('dependency-cruiser-effect-arch')
//   module.exports = effectArchDepcruise({ tsConfig: 'tsconfig.json' })

const defaultLayers = {
  domain: '^src/domain/',
  application: '^src/application/',
  infrastructure: '^src/infrastructure/',
  react: '^src/react/',
  app: '^src/app/',
  lib: '^src/lib/',
}

// alternation of anchored layer regexes for the given keys
const to = (layers, keys) => '(' + keys.map((k) => layers[k]).join('|') + ')'

function effectArchDepcruise(options = {}) {
  const layers = { ...defaultLayers, ...(options.layers || {}) }
  const tsConfig = options.tsConfig || 'tsconfig.json'
  const includeOnly = options.includeOnly || '^src/'

  return {
    forbidden: [
      {
        name: 'no-circular',
        severity: 'error',
        comment:
          'Circular dependencies make code hard to reason about and often hide layering mistakes.',
        from: {},
        to: { circular: true },
      },
      {
        name: 'domain-no-outward',
        severity: 'error',
        comment:
          'Domain is pure. It must not depend on application, infrastructure, react, app, or lib.',
        from: { path: layers.domain },
        to: { path: to(layers, ['application', 'infrastructure', 'react', 'app', 'lib']) },
      },
      {
        name: 'application-no-infra-or-ui',
        severity: 'error',
        comment:
          'Application orchestrates use cases over domain services. It must not import infrastructure, react, app, or lib.',
        from: { path: layers.application },
        to: { path: to(layers, ['infrastructure', 'react', 'app', 'lib']) },
      },
      {
        name: 'infrastructure-no-app-layers',
        severity: 'error',
        comment:
          'Infrastructure provides Live implementations of domain services. It must not import application, react, or app.',
        from: { path: layers.infrastructure },
        to: { path: to(layers, ['application', 'react', 'app']) },
      },
      {
        name: 'react-no-infrastructure',
        severity: 'error',
        comment:
          'React must not import infrastructure directly. Wire infra via the runtime layer in app.',
        from: { path: layers.react },
        to: { path: layers.infrastructure },
      },
    ],
    options: {
      doNotFollow: { path: ['node_modules'] },
      includeOnly,
      tsConfig: { fileName: tsConfig },
      tsPreCompilationDeps: true,
      enhancedResolveOptions: {
        exportsFields: ['exports'],
        conditionNames: ['import', 'require', 'node', 'default', 'types'],
        mainFields: ['module', 'main', 'types', 'typings'],
      },
    },
  }
}

module.exports = { effectArchDepcruise, defaultLayers }
module.exports.effectArchDepcruise = effectArchDepcruise
module.exports.default = effectArchDepcruise
