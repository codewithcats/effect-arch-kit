---
description: Wire the effect-arch enforcement presets (ESLint rules + dependency-cruiser) into this repo
argument-hint: "[optional path to a local effect-arch-kit clone, for file: links before the presets are on npm]"
allowed-tools: Bash, Read, Edit
---

# effect-arch-enforcement:setup

Wire mechanical enforcement of the effect-arch architecture rules into the current repo. The actual file surgery is done by a deterministic codemod (`effect-arch-init`) — your job is to detect the layout, preview the plan with the user, run the codemod, and confirm the rules are live. **Propose; let code write.**

## Step 1 — detect the layout

Inspect the repo so the codemod targets real paths:

```bash
ls -d src/domain src/application src/infrastructure src/react 2>/dev/null
ls src/app/RuntimeContext.tsx src/app/runtime.ts* 2>/dev/null   # the runtime module
test -f package.json && echo "package.json present"
```

If the layout differs from the default (`src/{domain,application,infrastructure,react}`, runtime in `src/app/RuntimeContext.tsx`), note the real runtime-module path — you'll pass it as `--runtime-file`.

## Step 2 — dry-run the codemod

The codemod ships in `eslint-config-effect-arch`. Two cases:

- **Presets published to npm:** `npx effect-arch-init --runtime-file <path>`
- **Not yet published (use a local clone):** the user may pass a path to their `effect-arch-kit` clone as `$ARGUMENTS`. Run the codemod from there with `--link` so dependencies resolve as `file:` links:
  ```bash
  node <clone>/packages/eslint-config-effect-arch/bin/init.mjs --cwd "$PWD" --runtime-file <path> --link <clone>
  ```

Run it **without `--write` first** and show the printed plan to the user. It lists exactly what will be written (`.claude/effect-arch.json`, `eslint.config.effect-arch.mjs`, `.dependency-cruiser.effect-arch.cjs`) and patched (`package.json`).

## Step 3 — apply

Re-run the same command with `--write`. Then:

```bash
npm install
```

## Step 4 — hook the fragment into the ESLint config

The codemod does **not** edit your existing `eslint.config.*` (splicing an arbitrary config is unreliable). Add the two lines it prints, at the end of the config array:

```js
import effectArchConfig from './eslint.config.effect-arch.mjs'
export default [ /* ...your existing config... */ ...effectArchConfig ]
```

Read the repo's ESLint config first; make the minimal edit to append the import and spread.

## Step 5 — confirm it's live

```bash
npx eslint src            # effect-arch/* errors now appear on violations
npx depcruise --config .dependency-cruiser.effect-arch.cjs src   # layer graph
```

Report to the user what was wired and that `effect-arch:review-architecture` will now skip the mechanical rules (the linter owns them). To roll everything back: `effect-arch-init eject` (see `effect-arch-enforcement:doctor` if anything looks off).

## Safety

- Always show the dry-run plan before `--write`.
- Never overwrite the user's existing ESLint config — only append the import + spread.
- If `package.json` is missing or the layout is unclear, stop and ask rather than guessing.
