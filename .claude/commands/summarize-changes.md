---
description: Summarize the current branch's diff off main, broken into committed / staged / unstaged.
allowed-tools: Bash, Read
---

Generate a concise summary of the current branch's diff off `main`.

1. First, determine the current branch:
   ```bash
   git rev-parse --abbrev-ref HEAD
   ```

2. If we are **not** on `main`, break the changes into three buckets:
   - **Committed diff off main** — `git diff main...HEAD`
   - **Staged diff** — `git diff --cached`
   - **Unstaged diff** — `git diff`

3. If we **are** on `main`, only look at uncommitted/staged changes.

Summarize the **new functionality** in each bucket. Be concise; highlight UI-facing changes, new components/hooks, store-slice changes, and any protocol changes that need backend coordination (WebSocket message shape).
