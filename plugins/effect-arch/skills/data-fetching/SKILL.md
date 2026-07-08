---
name: data-fetching
description: Patterns for data fetching with Effect-TS in React apps — Request/RequestResolver for batching and dedup, Cache and cachedWithTTL for SWR, Stream.paginateEffect for pagination, optimistic updates with Effect.onError rollback. Use when fetching data from APIs, mutating server state, building paginated or infinite lists, implementing optimistic UI, handling cache invalidation, or designing focus/interval refresh logic. For higher-level architecture (layers, services, error handling), use `effect-arch:architecture` first.
---

# Effect data fetching

Concrete patterns for moving data through the Effect runtime, replacing what a React app would otherwise get from TanStack Query. Pair with `effect-arch:architecture` for the dependency / layering rules.

> **Effect-version note.** Samples target a recent Effect release. If a symbol (`RequestResolver.contextFromServices`, `Effect.cachedWithTTL`, `Stream.paginateEffect`) doesn't match your installed version, trust your version. Samples that use `@effect-atom/atom-react` are marked **(Atom)** and have a `SubscriptionRef` fallback — skip them if you don't use Atom.

## Concept map (vs. TanStack Query)

| Concern | Effect primitive |
| --- | --- |
| Keyed in-memory cache | `Cache` / `Effect.cachedWithTTL` |
| Dedup of in-flight | `Request` + `RequestResolver` (structural equality, automatic batching) |
| Retry policy | `Schedule` + `Effect.retry` |
| Stale-while-revalidate | `Effect.cachedWithTTL` + background fiber |
| Focus / interval | `Stream.fromEventListener` / `Stream.fromSchedule` |
| Optimistic update | `SubscriptionRef.update` + `Effect.onError` (rollback) |
| Pagination | `Stream.paginateEffect` |
| Infinite scroll | `Atom.pull` (from `@effect-atom/atom-react`) |
| Cancellation | fiber interruption |

## A query as `Request` + `RequestResolver`

The foundational pattern — it gives you dedup and batching for free.

```ts
// domain layer: orders/requests.ts (default layout: src/domain/orders/requests.ts)
import { Request, RequestResolver, Effect, Schema } from 'effect'
import { HttpClient, HttpClientResponse } from '@effect/platform'
import { OrderId, Order, OrderSchema } from './model'
import { NotFoundError, NetworkError } from './errors'

// A Request is a *value* describing "I want order X".
// Two GetOrder with the same id are .equals() by structure.
export class GetOrder extends Request.TaggedClass('GetOrder')<
  Order,
  NotFoundError | NetworkError,
  { readonly id: OrderId }
> {}

// A resolver knows how to execute a batch of identical-shape requests.
export const GetOrderResolver = RequestResolver.makeBatched(
  (requests: ReadonlyArray<GetOrder>) =>
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient
      const ids = requests.map((r) => r.id).join(',')
      const response = yield* http.get(`/api/orders?ids=${ids}`).pipe(
        Effect.flatMap(HttpClientResponse.schemaBodyJson(Schema.Array(OrderSchema))),
        Effect.mapError((cause) => new NetworkError({ cause })),
      )
      // Resolve each request individually.
      yield* Effect.forEach(requests, (req) => {
        const hit = response.find((o) => o.id === req.id)
        return hit
          ? Request.succeed(req, hit)
          : Request.fail(req, new NotFoundError({ id: req.id }))
      })
    }),
).pipe(RequestResolver.contextFromServices(HttpClient.HttpClient))

// The use-case is composable. Three components calling getOrder(id)
// with the same id within one tick collapse into one HTTP call.
export const getOrder = (id: OrderId) =>
  Effect.request(new GetOrder({ id }), GetOrderResolver)
```

**When to use:** any read that might be called from multiple places concurrently (lists, dashboards, sidebars). The structural-equality dedup is what TanStack Query gives you imperatively; here you get it from `Request.TaggedClass`.

## Caching with TTL

```ts
import { Cache, Duration, Effect } from 'effect'

// 30-second TTL, max 500 entries.
export const makeOrderCache = Cache.make({
  capacity: 500,
  timeToLive: Duration.seconds(30),
  lookup: (id: OrderId) => getOrder(id),
})

// Read inside an Effect: returns cached if fresh, otherwise fetches and stores.
const program = Effect.gen(function* () {
  const cache = yield* makeOrderCache
  const order = yield* cache.get(id)
  return order
})
```

`Cache` is the right tool when you want simple TTL-based eviction. For stale-while-revalidate semantics, use the SWR pattern below.

## Stale-while-revalidate

Serve stale immediately, revalidate in background:

```ts
const makeSwrCell = <A, E, R>(fetch: Effect.Effect<A, E, R>, ttl: Duration.Duration) =>
  Effect.gen(function* () {
    const ref = yield* SubscriptionRef.make<{ value: A; fetchedAt: number } | null>(null)
    const revalidate = fetch.pipe(
      Effect.flatMap((value) =>
        Effect.clockWith((c) => c.currentTimeMillis).pipe(
          Effect.flatMap((now) => SubscriptionRef.set(ref, { value, fetchedAt: now })),
        ),
      ),
    )
    const read = Effect.gen(function* () {
      const current = yield* ref
      const now = yield* Effect.clockWith((c) => c.currentTimeMillis)
      const isStale = !current || now - current.fetchedAt > Duration.toMillis(ttl)
      if (!current) {
        yield* revalidate // blocking first fetch
        return (yield* ref)!.value
      }
      if (isStale) yield* Effect.forkDaemon(revalidate) // background
      return current.value
    })
    return { read, changes: ref.changes } as const
  })
```

This ~25-line pattern replaces most of TanStack Query's `staleTime` + `cacheTime` + `refetchOnWindowFocus`. Because it's built from `Clock` and `Fiber`, it tests deterministically with `TestClock` (read the time through `Clock`, never `Date.now()`, so tests stay hermetic).

## Focus and interval refetch as `Stream`

```ts
import { Stream, Schedule } from 'effect'

const refetchTriggers = Stream.merge(
  Stream.fromEventListener(window, 'focus'),
  Stream.fromSchedule(Schedule.spaced('30 seconds')),
)

export const liveOrderList = refetchTriggers.pipe(
  Stream.mapEffect(() => fetchOrders),
  Stream.changes, // emit only when payload actually changes
)
```

**(Atom)** Components subscribe via `useAtomValue(Atom.make(liveOrderList))`. **Fallback without Atom:** run the stream into a `SubscriptionRef` on a daemon fiber (`Stream.runForEach(liveOrderList, (v) => SubscriptionRef.set(ref, v))`) and expose `ref.changes` through your `useSubscriptionRef` hook. Either way the same `Stream` value can feed a background prefetch fiber or a `TestClock.adjust("30 seconds")`-driven test.

## Mutations + optimistic updates

The `Effect.onError` rollback pattern is the strict equivalent of TanStack Query's `onMutate` + rollback, but typed.

```ts
export const updateOrder = (id: OrderId, patch: Partial<Order>) =>
  Effect.gen(function* () {
    const cache = yield* OrderCache
    const http = yield* HttpClient.HttpClient
    const prev = yield* cache.get(id)

    // 1. Optimistic: patch cache immediately.
    yield* cache.set(id, { ...prev, ...patch })

    // 2. Fire the real request.
    return yield* http.patch(`/api/orders/${id}`, patch).pipe(
      Effect.flatMap(HttpClientResponse.schemaBodyJson(OrderSchema)),
      Effect.tap((updated) => cache.set(id, updated)),
      // 3. Rollback on failure OR interruption.
      Effect.onError(() => cache.set(id, prev)),
      // 4. Retry transient network errors, but not 4xx.
      Effect.retry({
        schedule: Schedule.exponential('200 millis').pipe(Schedule.upTo('5 seconds')),
        while: (e) => e._tag === 'NetworkError',
      }),
    )
  })
```

The `while: (e) => e._tag === "NetworkError"` is the typed-error payoff: a `Forbidden` or `NotFound` cannot accidentally trigger a retry, which is a class of TanStack Query bug every team writes once.

## Pagination

```ts
import { Stream, Option } from 'effect'

const orderPages = Stream.paginateEffect({ cursor: null as string | null }, ({ cursor }) =>
  http.get(`/api/orders?cursor=${cursor ?? ''}`).pipe(
    Effect.flatMap(HttpClientResponse.schemaBodyJson(PageSchema)),
    Effect.map((page) => [
      page.items,
      page.nextCursor ? Option.some({ cursor: page.nextCursor }) : Option.none(),
    ]),
  ),
)

// (Atom) In a component with @effect-atom/atom-react:
const [result, loadMore] = useAtom(Atom.pull(orderPages))
// result.items is the accumulated list; loadMore() pulls the next page.
```

**(Atom)** `Atom.pull` is the ready-made "pull one chunk, append, re-render" primitive for infinite scroll. **Fallback without Atom:** drive `Stream.paginateEffect` with `Stream.take`/`Stream.runCollect` into a `SubscriptionRef` that accumulates pages, and trigger the next pull from your hook. For traditional numbered pagination, fetch each page as its own `Effect` keyed by page number.

## Decision rules

- **One-off read of a single resource** → `Effect.cachedWithTTL` wrapping the fetch.
- **Many concurrent reads of structurally identical resources** → `Request` + `RequestResolver`. Lets the network see one request even when ten components ask.
- **Read with stale-tolerated UX (lists, dashboards)** → SWR cell.
- **Read that must reconcile with realtime** → consume a `DomainEvents` PubSub in addition to the read.
- **Write that should feel instant** → optimistic update with `Effect.onError` rollback.
- **Infinite scroll / "load more"** → `Stream.paginateEffect` (+ `Atom.pull` if you use Atom).
- **Background prefetch** → `Effect.forkDaemon(fetch)` at navigation, with a TTL'd cache to dedup.

## Known pitfalls

- **Don't define `Request` classes inline in component files.** They belong in the domain layer (default `src/domain/<feature>/requests.ts`) so the application layer can import them without dragging React.
- **Don't mix `Effect.runPromise` for fetch with React state.** Use the hook layer (`useEffectQuery`, `useAtomValue`) so the fiber is interrupted on unmount.
- **Don't forget `RequestResolver.contextFromServices(...)`.** Without it the resolver can't provide its dependencies and you get a confusing context-not-provided error at runtime.
- **`Cache.make` capacity matters.** Too low silently churns; too high holds memory. 500 is a reasonable default for per-resource caches; bump it for hot lists.
- **Don't retry mutations blindly.** Idempotent reads can retry freely. For non-idempotent mutations, gate retry on a typed `NetworkError` and never on `Conflict`/`Forbidden`/`Validation`.

## See also

- `effect-arch:architecture` — layer composition and service taxonomy.
- `effect-arch:testing` — testing these query/mutation patterns with `TestClock` and Layer mocks.
