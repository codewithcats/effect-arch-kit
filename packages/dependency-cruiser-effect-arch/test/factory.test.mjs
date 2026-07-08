import { test } from 'node:test'
import assert from 'node:assert/strict'
import { effectArchDepcruise } from '../index.js'

test('produces the five layer rules + no-circular', () => {
  const config = effectArchDepcruise()
  const names = config.forbidden.map((r) => r.name)
  assert.deepEqual(names, [
    'no-circular',
    'domain-no-outward',
    'application-no-infra-or-ui',
    'infrastructure-no-app-layers',
    'react-no-infrastructure',
  ])
})

test('domain rule forbids reaching every outer layer', () => {
  const config = effectArchDepcruise()
  const domain = config.forbidden.find((r) => r.name === 'domain-no-outward')
  for (const layer of ['application', 'infrastructure', 'react', 'app', 'lib']) {
    assert.match(domain.to.path, new RegExp(`\\^src/${layer}/`))
  }
})

test('respects custom layers and tsConfig', () => {
  const config = effectArchDepcruise({
    layers: { domain: '^app/core/', application: '^app/usecases/' },
    tsConfig: 'tsconfig.app.json',
  })
  const domain = config.forbidden.find((r) => r.name === 'domain-no-outward')
  assert.equal(domain.from.path, '^app/core/')
  assert.equal(config.options.tsConfig.fileName, 'tsconfig.app.json')
})
