---
description: Run ESLint and fix issues until the repo is clean.
allowed-tools: Bash, Read, Edit, Glob, Grep
---

Run ESLint (equivalent to the VS Code task "Lint"):

```bash
npm run lint
```

For each reported finding, read the file and fix the issue. Prefer fixing the underlying code over adding `// eslint-disable-*` comments.

Hard rules:

- Don't add `// eslint-disable-*` without a written justification — if one is truly needed, validate it with the user first.
- Don't replace a real fix with an `any` cast.

Re-run `npm run lint` until it exits clean.
