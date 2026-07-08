// eslint-plugin-effect-arch
//
// Each catalog entry becomes a real, named ESLint rule. Because the rule ids
// are real (not `no-restricted-syntax` message prefixes), they are greppable,
// individually configurable, and `// eslint-disable-next-line effect-arch/<id>`
// actually works. The skills cite these exact ids.
//
// A rule's `create` returns an object keyed by an esquery selector — ESLint
// invokes the handler for every matching node. This keeps every rule a
// one-liner over the shared catalog.

const catalog = require('./rules-catalog')
const pkg = require('./package.json')

const DOCS_BASE =
  'https://github.com/codewithcats/effect-arch-kit/tree/main/packages/eslint-plugin-effect-arch#'

/** @type {Record<string, import('eslint').Rule.RuleModule>} */
const rules = {}
for (const entry of catalog) {
  rules[entry.id] = {
    meta: {
      type: 'problem',
      docs: {
        description: entry.message,
        recommended: true,
        url: DOCS_BASE + entry.id,
      },
      schema: [],
      messages: { violation: entry.message },
    },
    create(context) {
      return {
        [entry.selector](node) {
          context.report({ node, messageId: 'violation' })
        },
      }
    },
  }
}

const plugin = {
  meta: { name: pkg.name, version: pkg.version },
  rules,
}

module.exports = plugin
module.exports.default = plugin
