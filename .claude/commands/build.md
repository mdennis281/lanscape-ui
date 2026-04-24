---
description: Run the full web + Electron build and triage any failures.
allowed-tools: Bash, Read, Edit, Glob, Grep
---

Run the full build:

```bash
npm run build:all
```

This runs in order: version stamp, `tsc -p tsconfig.app.json`, Vite build, `tsc -p tsconfig.electron.json`, CJS rename.

If the build fails, categorize the failure and address it:

| Category               | Indicators                                  | Fix                                                                   |
|------------------------|---------------------------------------------|------------------------------------------------------------------------|
| **TypeScript**         | `error TS####`                              | Use `/typecheck` to iterate faster, then re-run the build.            |
| **Vite / bundler**     | `Rollup failed`, `import resolution error`  | Check import paths, missing deps, aliases in `vite.config.*`.         |
| **Electron compile**   | `error TS####` under `tsconfig.electron.json` | Fix types in the electron entry; don't import `electron` from `src/`. |
| **CJS rename**         | `rename-cjs.js` failure                     | Inspect `scripts/rename-cjs.js` and `dist-electron/`.                 |

Once clean, report the artifacts produced (paths under `dist/` and `dist-electron/`).
