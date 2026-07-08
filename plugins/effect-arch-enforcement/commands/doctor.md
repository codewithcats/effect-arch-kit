---
description: Verify the effect-arch enforcement chain is intact in this repo, and flag version skew
allowed-tools: Bash, Read
---

# effect-arch-enforcement:doctor

Audit whether mechanical enforcement is actually wired and working in the current repo. Report each link in the chain as ✅ / ❌ / ⚠️, then a one-line verdict.

## Checks

Run these and interpret the results:

```bash
# 1. Sentinel present (setup ran)?
cat .claude/effect-arch.json 2>/dev/null || echo "MISSING sentinel"

# 2. Presets installed?
node -e "require.resolve('eslint-config-effect-arch'); console.log('config OK')" 2>/dev/null || echo "config MISSING"
node -e "require.resolve('eslint-plugin-effect-arch'); console.log('plugin OK')" 2>/dev/null || echo "plugin MISSING"
node -e "require.resolve('dependency-cruiser-effect-arch'); console.log('depcruise-preset OK')" 2>/dev/null || echo "depcruise-preset MISSING"

# 3. ESLint config actually spreads the fragment?
grep -rn "eslint.config.effect-arch" eslint.config.* 2>/dev/null || echo "fragment NOT imported into eslint config"

# 4. Rules resolve for a source file?
npx eslint --print-config src/app/RuntimeContext.tsx 2>/dev/null | grep -o "effect-arch/[a-z-]*" | sort -u || echo "no effect-arch rules active"

# 5. depcruise fragment present?
test -f .dependency-cruiser.effect-arch.cjs && echo "depcruise fragment OK" || echo "depcruise fragment MISSING"
```

## Version skew

Compare the version recorded in `.claude/effect-arch.json` against the installed preset:

```bash
node -e "const s=require('./.claude/effect-arch.json'); const p=require('eslint-config-effect-arch/package.json'); console.log('sentinel', s.version, '/ installed', p.version)" 2>/dev/null
```

If they differ, warn: the presets were updated but `setup` hasn't been re-run (or vice-versa). Recommend re-running `effect-arch-enforcement:setup` to realign. This is expected drift — the plugin and the npm presets update through different channels — and this check is the honest way to surface it.

## Verdict

- **All ✅** → "Enforcement is live. `effect-arch:review-architecture` can skip the mechanical rules."
- **Sentinel present but a link broken** → point at the first ❌ and the fix (usually `npm install` or adding the fragment import).
- **No sentinel** → "Enforcement not wired. Run `effect-arch-enforcement:setup`." (The skills still work as guidance.)
