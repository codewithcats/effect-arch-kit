// Single source of truth for the effect-arch rule ids, AST selectors, and
// messages. Both the ESLint plugin (index.js) and the skills' rule-id
// conformance check (scripts/check-skill-rule-ids.mjs) read from here, so a
// skill can never cite an `effect-arch/*` id that does not exist.
//
// Messages are intentionally layout-agnostic — they never hardcode a repo's
// paths (the config factory scopes rules to the right files; the message just
// explains the rule). `scope` documents where the config factory applies each
// rule; it is metadata, not enforced by the rule itself.

/** @type {ReadonlyArray<{id:string, selector:string, message:string, scope:string}>} */
module.exports = [
  {
    id: 'no-bare-fetch',
    selector: 'CallExpression[callee.name="fetch"]',
    message:
      'No bare fetch. Use HttpClient via the Effect runtime so the call is typed, retryable, and interruptible.',
    scope: 'all source',
  },
  {
    id: 'no-new-promise',
    selector: 'NewExpression[callee.name="Promise"]',
    message: 'No `new Promise()`. Model async work as an Effect.',
    scope: 'all source',
  },
  {
    id: 'no-module-scope-service',
    selector:
      'Program > VariableDeclaration > VariableDeclarator > NewExpression[callee.name=/(Service|Client|Repo)$/]',
    message:
      'No module-scope service construction. Provide services via Context.Tag + Layer, not `new *Service/Client/Repo()` at import time.',
    scope: 'all source',
  },
  {
    id: 'no-managed-runtime-make',
    selector:
      'CallExpression[callee.object.name="ManagedRuntime"][callee.property.name="make"]',
    message:
      'ManagedRuntime.make is only allowed in the runtime module. One runtime per app; sub-features compose Layers into it.',
    scope: 'all source except the runtime module',
  },
  {
    id: 'no-throw-in-core',
    selector: 'ThrowStatement',
    message:
      'No throw in domain/application code. Use Data.TaggedError / Schema.TaggedError for failures, or Effect.die for bugs.',
    scope: 'domain + application',
  },
  {
    id: 'no-real-timers-in-tests',
    selector:
      'CallExpression[callee.name=/^(setTimeout|setInterval|setImmediate)$/]',
    message: 'No real timers in tests. Use TestClock.adjust for deterministic time.',
    scope: 'tests',
  },
  {
    id: 'no-run-sync-in-components',
    selector:
      'CallExpression[callee.object.name="Effect"][callee.property.name="runSync"]',
    message:
      'No Effect.runSync in components. Use a hook (useAtomValue / useEffectQuery) or runPromise/runFork — runSync throws if the Effect suspends.',
    scope: 'components',
  },
]
