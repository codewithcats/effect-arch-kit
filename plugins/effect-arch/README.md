# effect-arch (guidance)

Pure-guidance Claude Code plugin: skills for a layered Effect-TS architecture in React apps, plus a semantic architecture-review command. Installing it adds guidance the model reads — it does not run anything or modify your repo.

## Contents

| Skill / command | Invoke | Purpose |
| --- | --- | --- |
| `architecture` | `effect-arch:architecture` | Hub: principles, layer graph, state triage, service taxonomy, anti-patterns |
| `data-fetching` | `effect-arch:data-fetching` | Request/Resolver, Cache/SWR, pagination, optimistic updates |
| `testing` | `effect-arch:testing` | `it.effect`, `TestClock`, Layer mocks, property tests, `Exit` snapshots |
| `review-architecture` | `/effect-arch:review-architecture` | Diff review for semantic violations linters miss |

## Enforcement

These skills name real lint rule ids (`effect-arch/no-bare-fetch`, …). To make those ids live errors in a repo, add the companion plugin:

```
/plugin install effect-arch-enforcement@effect-arch-kit
/effect-arch-enforcement:setup
```

Without it, the rules are guidance and the review command covers the mechanical ones too.
