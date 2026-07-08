---
name: architecture
description: Reference for a layered Effect-TS architecture in React apps. Use when working with Effect (Effect, Layer, Service, Context.Tag, Atom, ManagedRuntime, fiber, Schedule, Stream, Schema), when designing services, data fetching, state management, or error handling, or when Effect code looks unidiomatic and you want to check it against the rules. This is the hub — for data-fetching specifics use `effect-arch:data-fetching`, for tests use `effect-arch:testing`.
---

# Effect-TS architecture (hub)

A layered Effect-TS architecture for React apps. The layering, services, error model, and testing discipline are framework-agnostic and apply to any Effect codebase; the presentation-layer rules (hooks, `useState` vs `SubscriptionRef`, component tests) are React-specific and called out as such.

## Adapting this to your project

This skill teaches **roles**, not fixed paths. Map each role to wherever it lives in your repo. The default layout (used in the examples) is:

| Role | Default path | What lives here |
| --- | --- | --- |
| Domain | `src/domain/<feature>/` | Schema types, branded IDs, tagged errors, `Context.Tag` service interfaces, pure functions |
| Application | `src/application/<feature>/` | Use-cases composing domain + infra services (no React) |
| Infrastructure | `src/infrastructure/<feature>/` | `Layer` implementations (`*Live`) of the domain service Tags |
| Presentation | `src/react/{components,hooks,features}/` | Components, hooks, one `ManagedRuntime` |
| Runtime module | `src/app/RuntimeContext.tsx` | The **one** place `ManagedRuntime.make` is allowed |
| Composition root | `src/app/layers.ts` | Where the app `Layer` is assembled from all `*Live` layers |

If your layout differs, substitute your own paths — the rules travel.

**Enforcement status (check once per session).** Some rules below can be *mechanically* enforced by the companion enforcement kit (`eslint-plugin-effect-arch` + `dependency-cruiser-effect-arch`, installed via the `effect-arch-enforcement` plugin's `setup`). Detect whether this repo has it: look for `eslint-config-effect-arch` / `eslint-plugin-effect-arch` in `package.json`, an `effectArch(` call in the ESLint config, or a `.claude/effect-arch.json` sentinel.

- **Kit present** → a violation of a named rule (e.g. `effect-arch/no-bare-fetch`) is a **lint error at edit time and in CI**. Fix the design; never add an `eslint-disable`.
- **Kit absent** → these rules are **guidance only. You are the enforcement** — read the diff and apply them by hand, and note that `effect-arch:review-architecture` also has to cover the mechanical rules because no linter will.

## The eight principles

These are non-negotiable. Every other rule traces back to one of them.

1. **All I/O is an `Effect`.** Anything that touches the network, storage, the clock, or randomness is an `Effect`, never a bare `Promise`, raw `fetch`, `setTimeout`, `Math.random`, `localStorage`, etc. A bare async boundary can't be typed, retried, interrupted, or tested through a clock.
2. **Errors live in the type.** Domain failures are tagged errors in the `E` channel. Unexpected bugs are `Effect.die(...)`. No `throw` in domain or application code — a thrown value is invisible to the type system, so callers can't know what can go wrong.
3. **Layers define the dependency graph.** Every capability is a `Context.Tag` provided by a `Layer`. No singletons, no module-level `new ApiClient()` — construction-at-import-time defeats dependency injection and makes test substitution impossible.
4. **React is a projection of Effect state.** Components render the current value of an `Atom` / `SubscriptionRef` / query result. They do not own non-UI state. (React-specific.)
5. **One `ManagedRuntime` per app, many fibers per runtime.** One runtime built at app bootstrap in the runtime module; sub-features get Layers composed into it, not their own runtime. Two runtimes from the same Layer do **not** share service instances.
6. **The hook boundary is thin.** `useEffectQuery`, `useSubscriptionRef`, `useEffectMutation`, `useAtomValue` translate Effects to React state and contain **no business logic**. (React-specific.)
7. **Determinism by default in tests.** `it.effect` + `TestClock` + a mock `HttpClient` Layer. `setTimeout(done, 1000)` in a test is a code smell.
8. **Schema is the source of truth for contracts.** API request/response, form inputs, branded primitives — all `effect/Schema`. Types, runtime decoders, and test arbitraries derive from it.

## Layer architecture

Strictly inward dependencies. No layer ever imports from the layer above it.

```
┌─────────────────────────────────────────────────────────────┐
│ Presentation (React)                                        │
│  • Components, routes, forms, error boundaries              │
│  • Hooks: useEffectQuery / useSubscriptionRef / useAtom*    │
│  • One ManagedRuntime, held in the runtime module           │
└────────────────────────▲────────────────────────────────────┘
                         │ provides Runtime, reads Effect<A,E,R>
┌────────────────────────┴────────────────────────────────────┐
│ Application (use-cases)                                     │
│  • loadOrderList, placeOrder, recordPayment                 │
│  • Composed Effects orchestrating domain + infra            │
│  • No React imports                                         │
└────────────────────────▲────────────────────────────────────┘
                         │ requires Tags (AuthService, OrderRepo, ...)
┌────────────────────────┴────────────────────────────────────┐
│ Domain (pure)                                               │
│  • Schema types, branded IDs                                │
│  • Tagged errors                                            │
│  • Service interfaces (Context.Tag)                         │
│  • Pure functions                                           │
└────────────────────────▲────────────────────────────────────┘
                         │ implemented by
┌────────────────────────┴────────────────────────────────────┐
│ Infrastructure                                              │
│  • HttpClient / API-wrapper Layers                          │
│  • WebSocket as Stream                                      │
│  • LocalStorage, Telemetry, Logger Layers                   │
└─────────────────────────────────────────────────────────────┘
```

## Where does this state belong? (triage flowchart)

When you reach for state, walk this top-down. Stop at the first `YES`. (React-specific.)

```
Is the state purely UI (open/closed, hover, form draft)?
   YES → useState. Do not over-engineer.
   NO ↓
Is the state derived from server data already in a cache?
   YES → derived Atom / Effect.map. Do not duplicate.
   NO ↓
Is it observed by multiple components that aren't ancestor/descendant?
   YES → SubscriptionRef in a service, exposed via a hook.
   NO ↓
Is it a cross-cutting event (auth state, feature flag changed, toast)?
   YES → PubSub in a service.
   NO → probably useState after all.
```

A typical mid-size SaaS ends up with 5–10 `SubscriptionRef`s total. If your "global state" surface is bigger than that, you have crossed into Redux territory and should re-triage.

## Service taxonomy

Services are tiered by dependency depth. Lower tiers have no dependencies on higher tiers.

| Tier | Examples | Where |
| --- | --- | --- |
| 0 | `HttpClient`, `KeyValueStore`, `Clock`, `Random` | from platform |
| 1 | `AppConfig`, `Logger`, `Telemetry`, `FeatureFlags` | infrastructure |
| 2 | `ApiClient`, `AuthService`, `WebSocketService`, `DomainEvents` | infrastructure |
| 3 | `OrderRepo`, `CustomerRepo`, `ProductRepo`, `InvoiceRepo` | infrastructure |

Each service: one `Context.Tag` in the domain layer, one `Layer` named `*Live` in infrastructure, one `Layer` named `*Test` in your test-layers location. `*Live` is provided at the composition root; tests provide `*Test`.

## The anti-patterns

The bugs people repeat when first using Effect-TS. Each names the rule id the enforcement kit uses (when installed); when the kit is absent, treat the same line as a review checklist item.

1. **Runtime leaks.** `ManagedRuntime.make(...)` inside a component body or at module scope creates a new runtime on every render or import. Always `useMemo([], () => ManagedRuntime.make(Layer))` and dispose on unmount. → `effect-arch/no-managed-runtime-make` (allowed only in the runtime module).
2. **Layer duplication across sub-runtimes.** Two runtimes built from the same Layer do _not_ share instances — correct but surprising. If you see "two `AuthService`s fighting", you have two runtimes. (Review item.)
3. **Over-effectifying trivial code.** `Effect.succeed(x).pipe(Effect.map(v => v + 1))` is wrong when `x + 1` would do. Lift into `Effect` only at boundaries that need DI, error channels, resource management, or concurrency. (Review item.)
4. **Fiber leaks in `useEffect`.** `Runtime.runFork(rt)(work)` without interrupt-on-cleanup leaks the fiber. Always: `useEffect(() => { const f = Runtime.runFork(rt)(work); return () => Runtime.runPromise(rt)(Fiber.interrupt(f)) }, [rt])`. (Review item; React-specific.)
5. **Running an Effect on every render.** `Atom.make(someEffect)` inside a component body re-creates the atom each render and resubscribes. Define atoms at module scope. (Review item; React-specific.)
6. **Swallowing `Cause` info in error boundaries.** `catch (e) { showToast(e.message) }` throws away fiber traces, interruption info, and sub-causes. Use `Cause.pretty` for developer logs and tagged-error pattern-match for user-visible copy. (Review item.)
7. **Module-scope runtimes.** `const runtime = ManagedRuntime.make(...)` at module scope acquires resources before React mounts and is not disposed on hot reload. Always inside the runtime module. → `effect-arch/no-managed-runtime-make`.
8. **Bare `fetch` / `new Promise` for I/O.** Reach for `HttpClient` and `Effect` instead — a bare async boundary escapes DI, typed errors, and interruption. → `effect-arch/no-bare-fetch`, `effect-arch/no-new-promise`.
9. **`Effect.runSync` in components.** `runSync` throws if the Effect suspends. In React you almost always want `runPromise`/`runFork`, or let an Atom handle it. → `effect-arch/no-run-sync-in-components` (React-specific).
10. **Testing time with real timers.** `setTimeout(() => done(), 1000)` in a test means something isn't abstracted through `Clock`. Use `TestClock.adjust`. → `effect-arch/no-real-timers-in-tests`.
11. **Module-scope service construction.** `const repo = new OrderRepo()` at module scope defeats DI. Services come from Tags + Layers. → `effect-arch/no-module-scope-service`.
12. **The `it.layer` `TestContext` gotcha.** By default `it.layer`'s layer construction does not run inside `TestContext`. If a Layer's constructor depends on `TestClock`, compose `TestContext.TestContext` into the layer explicitly. ([Effect-TS issue #3718](https://github.com/Effect-TS/effect/issues/3718) — recheck whether this is still open before treating it as evergreen.)

## When you should pop into a specialist skill

- **Data fetching** (Request/Resolver, Cache, SWR, optimistic updates, pagination, Stream) → invoke `effect-arch:data-fetching`.
- **Tests** (`it.effect`, `TestClock`, fake-Layer setup, property tests, MSW vs. Layer mocking) → invoke `effect-arch:testing`.

## Using this inside an implement/PR flow

When you use these patterns while implementing a change:

- Load this skill **before** planning, so the plan places new code in the right layer role (domain / application / infrastructure / presentation) and reaches for Effect primitives (Tag + Layer, Schema for contracts, tagged errors, no `throw`).
- If the enforcement kit is installed, **architecture-lint failures are design bugs** — fix the design, never silence them with `eslint-disable` on new code.

## Versioning note

Code samples target a recent Effect release. Effect's API surface moves; if a symbol here (`RequestResolver.contextFromServices`, `Effect.cachedWithTTL`, `Stream.paginateEffect`, `@effect/vitest`) doesn't match your installed version, trust your version and adjust.
