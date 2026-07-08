---
description: Review changes against the Effect-TS architecture rules and report semantic violations that linters can't catch
argument-hint: "[optional path or PR#] (defaults to changed files vs the default branch)"
allowed-tools: Bash, Read, Glob, Grep
---

# review-architecture

Review the diff (or specified scope) against the Effect-TS architecture rules from the `effect-arch:architecture` skill. Focus on **judgment-call violations a linter cannot catch** — semantic mistakes that compile fine and pass tests but drift from the architecture.

**First, load the `effect-arch:architecture` skill** so this review uses one source of truth for the principles and anti-patterns rather than a second, drifting copy.

**Scope depends on whether the enforcement kit is installed** (detect it: `eslint-plugin-effect-arch` / `eslint-config-effect-arch` in `package.json`, an `effectArch(` call in the ESLint config, or a `.claude/effect-arch.json` sentinel):

- **Kit present** → skip the mechanical rules; `npm run lint` + `npm run depcruise` already guarantee no bare `fetch`, no `throw` in domain/application, layer-boundary imports, `ManagedRuntime.make` outside the runtime module, `setToInterval`/timers in tests. Your value here is the semantic rules below.
- **Kit absent** → there is no linter catching the mechanical rules, so **also** flag those (bare `fetch`, `new Promise`, `throw` in domain/application, module-scope service construction, timers in tests, `Effect.runSync` in components) in addition to the semantic rules.

## Scope resolution

If `$ARGUMENTS` is provided:

- A path → review files matching it.
- A PR number (e.g. `#123`) → if `gh` is available, `gh pr diff <num>` and review changed files; if not, ask the user to check out the branch and re-run with no argument.

Otherwise, default to the working diff against the default branch:

```bash
# Detect the default branch (don't assume "main").
default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
default_branch=${default_branch:-main}
base=$(git merge-base "origin/$default_branch" HEAD 2>/dev/null || echo "origin/$default_branch")
git diff "$base"...HEAD --name-only
```

Filter to source files (default layout: `src/`; adjust to the repo's layout) and this plugin's config.

## What to check

### Layer discipline (semantic)

1. **Domain purity.** Domain files should be pure: only `Schema`, `Context.Tag`, tagged errors (`Data.TaggedError` / `Schema.TaggedError`), and pure functions. No `Layer`, no `Effect.runtime`, no IO.
2. **Application no-React.** Application files must not import any React module (`react`, `react-dom`, react-router, hooks libs).
3. **Infrastructure exposes Layers, not values.** `*Live` files should export a `Layer` value, not a bare service instance.
4. **Service trio.** Each service should have: a `*Tag` in the domain layer, a `*Live` Layer in infrastructure, and a `*Test` Layer in the test-layers location (or co-located). Flag any service missing one.

### Hook boundary (React)

5. **Hooks are thin adapters.** Hook files should translate `Effect`/`Atom` → React state and nothing else. Business logic (calculations, branching on domain rules, multi-step orchestration) belongs in the application layer.
6. **`useState` only for purely UI state.** Walk every `useState` in changed files. If the value is observed by a non-ancestor/descendant component, derived from server data already cached, or part of a cross-cutting event (auth, feature flags, toasts) — it belongs in `SubscriptionRef`/`PubSub`, not `useState`.

### Effect mechanics

7. **Module-scope service construction.** No `new ApiClient()` / `new *Service()` / `new *Repo()` at module scope. Services come from Tags + Layers.
8. **Multiple `ManagedRuntime`s.** There should be exactly one `ManagedRuntime.make(...)` in the repo, in the runtime module. Flag any other call site.
9. **`Effect.runSync` in components/hooks.** Should be `runPromise`/`runFork` or handled by an Atom. `runSync` throws on suspension.
10. **Atoms inside component bodies.** `Atom.make(someEffect)` inside a function component recreates the atom on every render. Atoms belong at module scope.
11. **Fiber leaks in `useEffect`.** `Runtime.runFork(rt)(work)` without an interrupt cleanup leaks the fiber. Pattern: `return () => Runtime.runPromise(rt)(Fiber.interrupt(fiber))`.

### Effect over-engineering

12. **Over-effectified pure code.** `Effect.succeed(x).pipe(Effect.map(f))` where `f(x)` directly would do. Lift into `Effect` only at boundaries that need DI, error channels, resource management, or concurrency.
13. **Unnecessary `Effect.gen`.** Single-step `Effect.gen(function* () { return yield* foo })` should be just `foo`.

### Tests (semantic)

14. **MSW used in unit/integration tests.** MSW is allowed only at the E2E tier. Unit and integration tests should mock HTTP via `Layer.succeed`.
15. **Test mocks too broad.** A test layer should fake the smallest surface needed. If a test layer provides 12 methods but the test exercises 1, the mock is doing too much.
16. **`it.layer` `TestContext` gotcha.** If a Layer's constructor depends on `TestClock` and the test uses `it.layer`, the layer must be composed with `TestContext.TestContext` explicitly (Effect-TS issue #3718).
17. **Snapshot drift in `Exit` tests.** Snapshots that include stack traces, timestamps, or random IDs are unstable. Strip those before snapshotting.

### Error handling

18. **Error boundary swallows `Cause`.** `catch (e) { showToast(e.message) }` throws away fiber traces, interruption info, sub-causes. Use `Cause.pretty` for dev logs and tagged-error pattern-match for user copy.
19. **Retry policies that retry the wrong errors.** `Effect.retry({ ... })` without a `while:` filter, or with a filter that includes 4xx errors. The typed-error payoff is that `while: e => e._tag === "NetworkError"` cannot accidentally retry a `Forbidden` — flag any retry that doesn't use it.

## How to report

For each violation, output one block:

```
[severity] path/to/file.ts:LINE — short description

  Rule: <number from above>
  Why: <one-line explanation of the architectural concern>
  Fix: <concrete one-line suggestion>
```

Severities:

- **🔴 must-fix** — clear violation; block merge unless an ADR overrides it
- **🟡 should-fix** — drift; worth fixing but not blocking
- **🟢 consider** — judgment call worth a second look

End with:

```
## Summary

- 🔴 must-fix: N
- 🟡 should-fix: N
- 🟢 consider: N

Files reviewed: M
Rules checked: <19, or more if the kit is absent>
```

If nothing to flag: `Architecture review: no violations found across {M files}.`

## Project-specific overrides (local ADRs win)

A violation may be intentional per a project decision. **Before finalizing, look for the repo's own architecture decision records** — check `docs/adr/`, `docs/decisions/`, or `adr/` if present. If a local ADR explicitly sanctions a pattern this review flags, **downgrade it to 🟢 and cite the ADR** — the repo's own recorded decisions are authoritative over these generic rules.
