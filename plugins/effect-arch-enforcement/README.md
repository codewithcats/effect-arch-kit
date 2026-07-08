# effect-arch-enforcement (opt-in)

Makes the effect-arch architecture rules **mechanically enforced** in a repo you choose. Separate from the guidance plugin on purpose: a plugin that runs a linter on every file you edit should be opt-in per repo, not a default.

## What it adds

- **A PostToolUse lint hook** (`hooks/lint-on-edit.mjs`) — after you edit a `src/**` TypeScript file, it surfaces any `effect-arch/*` lint issues back to the model. It is:
  - **cross-platform** (Node, no bash/`jq` — runs on Windows),
  - **report-only** (never `--fix`s the file you just wrote — that would race the model's in-memory copy),
  - **opt-in** (no-ops unless the repo has the kit wired), and
  - **non-blocking** (any error → it stays out of your way).
- **`/effect-arch-enforcement:setup`** — detects your layout, previews, and runs the `effect-arch-init` codemod to wire `eslint-plugin-effect-arch` + `dependency-cruiser-effect-arch` into the repo. `--dry-run` by default, `eject`-reversible.
- **`/effect-arch-enforcement:doctor`** — verifies the enforcement chain and flags plugin-vs-preset version skew.

## Prerequisite

The enforcement **presets** (`eslint-plugin-effect-arch`, `eslint-config-effect-arch`, `dependency-cruiser-effect-arch`) live in the [effect-arch-kit](https://github.com/codewithcats/effect-arch-kit) repo under `packages/`. Until they're published to npm, `setup` can wire them as `file:` links against a local clone (`setup <path-to-clone>`). After publish, `setup` uses normal npm versions.

## Uninstalling from a repo

```
effect-arch-init eject     # removes the fragments, sentinel, and the deps/scripts init added
```
