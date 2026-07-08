# effect-arch-kit

Reusable **Effect-TS architecture guidance** for React apps, packaged as Claude Code plugins — plus an optional kit that makes the rules *mechanically enforced* in any repo.

Extracted and genericized from a production React + Effect-TS codebase. Two tiers, installed independently:

| Plugin | What it is | Side effects |
| --- | --- | --- |
| **`effect-arch`** | Three guidance skills (architecture hub, data-fetching, testing) + a semantic `review-architecture` command | **None.** Pure guidance the model reads. Install everywhere. |
| **`effect-arch-enforcement`** | An edit-time lint hook + a `setup`/`doctor` command that wires `eslint-plugin-effect-arch` and `dependency-cruiser-effect-arch` into a target repo | Runs a linter on edits and (via `setup`) writes config into the repo you opt in. Install only where you want it. |

> **Scope.** The layering, service, error-model, and testing patterns are framework-agnostic and apply to any Effect codebase (backend included). The presentation-layer rules — hooks, `useState` vs `SubscriptionRef`, React Testing Library — are React-specific and labeled as such throughout.

## Install

```
/plugin marketplace add codewithcats/effect-arch-kit
/plugin install effect-arch@effect-arch-kit                 # guidance — install everywhere
/plugin install effect-arch-enforcement@effect-arch-kit     # enforcement — only where you want it
```

Then, in a repo you want mechanically enforced:

```
/effect-arch-enforcement:setup     # detects your layout, previews, and wires the presets (--dry-run + eject supported)
/effect-arch-enforcement:doctor    # verifies the enforcement chain is intact
```

## The skills (Plugin A)

Once installed, these auto-trigger on relevant work and are also directly invocable:

- **`effect-arch:architecture`** — the hub. Eight principles, the layered dependency graph, a state-placement triage flowchart, the service taxonomy, and the anti-patterns. Start here.
- **`effect-arch:data-fetching`** — Request/Resolver batching, `Cache`/SWR, `Stream.paginateEffect`, optimistic updates with typed rollback. The Effect answer to TanStack Query.
- **`effect-arch:testing`** — `it.effect` + `TestClock`, `Layer.succeed` HTTP mocking (vs MSW), property tests, `Exit` snapshots.
- **`/effect-arch:review-architecture`** — reviews a diff against the semantic rules a linter can't catch.

Every skill teaches **roles**, not fixed paths — map them to your repo's layout via the layout table in the architecture skill.

## The honesty seam

The skills state each rule twice:

1. **Unconditional guidance** — true in any repo ("all I/O is an `Effect`").
2. **A conditional enforcement line** naming a real lint id — `effect-arch/no-bare-fetch`. That id exists in the published `eslint-plugin-effect-arch` whether or not you've installed the enforcement kit, so the citation is never a lie: with the kit it's *"this is a lint error now"*; without it, *"this is what would enforce it — you are the enforcement."*

This is why enforcement is a **separate, opt-in plugin**: a public plugin that runs a linter on every file you edit should be something you choose per repo, not a default.

## Repository layout

```
effect-arch-kit/
  .claude-plugin/marketplace.json     # this repo is its own marketplace
  plugins/
    effect-arch/                      # Plugin A — guidance (skills + review command)
    effect-arch-enforcement/          # Plugin B — hook + setup/doctor
  packages/
    eslint-plugin-effect-arch/        # real named rules (effect-arch/*)
    eslint-config-effect-arch/        # flat-config factory + `init` codemod
    dependency-cruiser-effect-arch/   # layer-boundary rule factory
  scripts/                            # residue + rule-id conformance checks
  docs/
```

## Distribution

The plugins install via the Claude Code marketplace (git-based — no npm publish needed). The enforcement **presets** are consumed as git-dependencies pinned to a tag until there's a reason to publish them to npm.

## License

MIT © codewithcats. See [LICENSE](LICENSE).
