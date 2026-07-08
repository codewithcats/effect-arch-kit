export const loadOrders = Effect.gen(function* () {
  const http = yield* HttpClientTag
  return yield* http.get('/api/orders')
})
