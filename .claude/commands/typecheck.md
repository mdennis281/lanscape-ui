---
description: Run TypeScript project-references build and fix type errors.
allowed-tools: Bash, Read, Edit, Glob, Grep
---

Run the TypeScript typecheck (equivalent to the VS Code task "Type Check"):

```bash
npm run typecheck
```

This runs `tsc -b` across the project references (app + electron). For each error:

1. Read the file and surrounding context.
2. Fix the types properly — prefer narrowing, generics, or explicit type annotations over `any` or `@ts-ignore`.
3. Re-run `npm run typecheck`.

Hard rules:

- Do not suppress errors with `@ts-ignore` or `@ts-expect-error` without an inline justification, and flag such additions to the user.
- Do not widen to `any` — if a type is genuinely unknown, use `unknown` and narrow at the use site.
