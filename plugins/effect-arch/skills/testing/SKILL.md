---
name: testing
description: Patterns for testing Effect-TS code in React apps — `it.effect` with `TestClock` for deterministic time, `Layer.succeed` for HTTP mocking instead of MSW, `it.prop` with `Schema.Arbitrary` for property-based tests, snapshotting `Exit` for orchestration tests. Use when writing tests, mocking HTTP / Clock / Random, testing retries or exponential backoff, debugging flaky time-based tests, generating test arbitraries from Schemas, or deciding between Layer mocks and MSW. For architecture / dependency rules, use `effect-arch:architecture` first.
---

# Effect testing

Concrete patterns for testing Effect code. The unit/integration/property patterns are framework-agnostic; the component-test section is React-specific.

> **Effect-version note.** Samples target `@effect/vitest` on a recent Effect release. If `it.effect` / `it.prop` / `it.layer` APIs don't match your installed version, trust your version.

## The four kinds of tests

| Kind | Tool | Exercises |
| --- | --- | --- |
| Pure unit | `it.effect` | A single Effect or pure function |
| Integration | `it.effect` + custom `Layer` | A use-case against fake infrastructure |
| Property | `it.prop` | Invariants over generated inputs (`Schema.Arbitrary`) |
| Component | RTL + test runtime | One component with a test `ManagedRuntime` (React-specific) |

Default to integration tests for use-cases — they're nearly free with `Layer.succeed` and they catch the bugs unit tests miss. Reserve pure unit tests for genuinely-pure helpers.

## Mocking HTTP by swapping a Layer

For unit and integration tests, swap `HttpClient.HttpClient` with a `Layer.succeed` that returns canned responses. **MSW is not needed at this tier.**

```ts
// test-layers location (default: src/test/layers/HttpClientTest.ts)
import { Layer, Effect } from 'effect'
import { HttpClient, HttpClientResponse } from '@effect/platform'

export const HttpClientTest = (
  routes: Record<string, (req: Request) => HttpClientResponse.HttpClientResponse>,
) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((req) => {
      const key = `${req.method} ${new URL(req.url).pathname}`
      const handler = routes[key]
      if (!handler) throw new Error(`Unmocked route: ${key}`)
      return Effect.succeed(handler(req))
    }),
  )
```

Use it:

```ts
import { it, assert } from '@effect/vitest'

it.effect('loads orders', () =>
  Effect.gen(function* () {
    const orders = yield* loadOrders
    assert.strictEqual(orders.length, 2)
  }).pipe(
    Effect.provide(OrderRepoLive),
    Effect.provide(
      HttpClientTest({
        'GET /api/orders': () =>
          HttpClientResponse.jsonArray([
            { id: '1', name: 'Order #1001' },
            { id: '2', name: 'Order #1002' },
          ]),
      }),
    ),
  ),
)
```

**When to use MSW instead:** end-to-end tests that exercise the real `fetch` path (Playwright suites, smoke tests against a staged backend). For everything below E2E, `Layer.succeed` is faster, more precise, and hermetic.

## TestClock for time-based logic

Any logic that involves delay, timeout, retry, schedule, or interval should be testable through `TestClock`. `setTimeout(done, 1000)` in a test is always a code smell.

```ts
import { it, assert } from '@effect/vitest'
import { Effect, TestClock, Fiber, Schedule } from 'effect'

it.effect('retries transient errors with exponential backoff', () =>
  Effect.gen(function* () {
    let attempts = 0
    const op = Effect.sync(() => {
      attempts++
      if (attempts < 3) throw new NetworkError({ cause: 'timeout' })
      return 'ok'
    })

    const fiber = yield* Effect.fork(op.pipe(Effect.retry(Schedule.exponential('100 millis'))))

    // First attempt runs immediately. Second is scheduled at 100ms.
    yield* TestClock.adjust('100 millis')
    // Third at 300ms (100 + 200).
    yield* TestClock.adjust('200 millis')

    const result = yield* Fiber.join(fiber)
    assert.strictEqual(result, 'ok')
    assert.strictEqual(attempts, 3)
  }),
)
```

`it.effect` automatically provides `TestContext`, which includes `TestClock` and `TestRandom`. The whole test runs in microseconds and is perfectly deterministic.

## Property-based tests with `it.prop`

When the input space is non-trivial, property tests beat example tests. `Arbitrary.make` derives generators from any `Schema`.

```ts
import { it } from '@effect/vitest'
import { Schema, Arbitrary, FastCheck } from 'effect'

const Order = Schema.Struct({
  id: Schema.String,
  amountCents: Schema.Number,
})

it.prop(
  'totalAmountCents is associative',
  [FastCheck.array(Arbitrary.make(Order))],
  ([orders]) =>
    Effect.gen(function* () {
      const half = Math.floor(orders.length / 2)
      const a = orders.slice(0, half)
      const b = orders.slice(half)
      assert.strictEqual(totalAmountCents([...a, ...b]), totalAmountCents(a) + totalAmountCents(b))
    }),
)
```

**When to reach for property tests:** invariants (associativity, idempotence, monotonicity), pure transformations (parsing/serialization roundtrips), permission checks ("admin can do X for any tenant"), invariants on collections.

## Snapshotting `Exit`

For complex orchestrations, snapshot the `Exit` to capture the full success/failure structure including `Cause`.

```ts
it.effect('bootstrap sequence', () =>
  pipe(
    bootstrapApp,
    Effect.exit,
    Effect.tap((exit) => Effect.sync(() => expect(exit).toMatchSnapshot())),
  ),
)
```

`Exit` captures the exact chain of errors, interruptions, and defects. Regressions in error pathways are caught — the kind of bug example tests miss because they only assert on the success path. **Strip volatile data** (stack traces, timestamps, random IDs) before snapshotting, or assert on `Cause.failureOption(exit.cause)` instead.

## Component tests (React Testing Library)

React-specific. Wrap the component under test in a `RuntimeProvider` whose runtime is built from a `TestAppLayer` (the test variant of the production app layer).

```ts
const TestAppLayer = Layer.mergeAll(
  HttpClientTest({ /* ... */ }),
  AuthServiceTest,
  // ... other test layers
)

function renderWithRuntime(ui: ReactElement) {
  const runtime = ManagedRuntime.make(TestAppLayer)
  return render(<RuntimeCtx.Provider value={runtime}>{ui}</RuntimeCtx.Provider>)
}
```

This keeps the unit-of-test the same as the production code path. The component sees a real runtime; only the leaf services are faked.

## The `it.layer` `TestContext` gotcha

By default, `it.layer`'s layer construction does **not** run inside `TestContext`. Only the test body does. If a Layer's constructor depends on `TestClock` (e.g., a service that schedules a daemon fiber at construction time), composing `TestContext.TestContext` into the layer is required.

```ts
const MyServiceTest = Layer.provide(MyServiceLive, TestContext.TestContext)
//                                                 ^^^^^^^^^^^^^^^^^^^^^^^^
// Without this, the service's daemon fiber uses real Clock during construction.
```

Tracked as [Effect-TS issue #3718](https://github.com/Effect-TS/effect/issues/3718). **Recheck before relying on it** — if it has been fixed upstream, this workaround may be unnecessary in your version.

## Decision rules

- **HTTP behavior** → `Layer.succeed` mock. MSW only at E2E.
- **Time / delay / retry / schedule** → `TestClock.adjust`. Never real timers.
- **Random IDs / shuffles** → `TestRandom.feedInts`/`feedDoubles`. Never `Math.random` in code under test.
- **Pure invariants over a non-trivial input space** → `it.prop`.
- **Complex success/failure flows** → snapshot the `Exit`.
- **Component behavior** → RTL + a test runtime built from `TestAppLayer`.
- **End-to-end smoke** → Playwright + a real staged backend. Outside this skill's scope.

## Folder layout

```
<test-layers location, default src/test/>
  layers/
    HttpClientTest.ts       # canned-route HTTP mock
    AuthServiceTest.ts      # fake auth state
    ClockTest.ts            # if you need a custom Clock variant
  fixtures/
    orders.ts               # canned data values
  setup.ts                  # vitest setup (RTL matchers, etc.)
```

Co-locate per-feature test layers with the feature when only that feature uses them. Promote to a shared test-layers location when used across two or more features.

## Known pitfalls

- **Forgetting to provide `TestContext`.** `it.effect` provides it; `it.scoped` provides it; `Effect.runPromise` outside vitest does not. If your test passes outside vitest but fails inside (or vice versa), check `TestContext` provisioning.
- **Testing real `fetch`.** If you find yourself spinning up MSW in a unit test, the unit-of-test is too big. Either narrow the test (use a Layer mock) or move it to E2E.
- **Using `Effect.runSync` in a test.** If the Effect suspends, `runSync` throws. `it.effect`'s default machinery uses `runPromise` and handles suspension. Reach for `runSync` only for genuinely pure-sync Effects.
- **Snapshotting volatile data in `Exit` snapshots.** Stack traces, timestamps, and randomly-generated IDs make snapshots unstable. Strip those before snapshotting.
- **Sharing `ManagedRuntime` across tests.** Each test should get a fresh runtime. Otherwise SubscriptionRefs hold state across tests and you get phantom failures.

## See also

- `effect-arch:architecture` — layer composition and service taxonomy.
- `effect-arch:data-fetching` — the query/mutation patterns these tests exercise.
