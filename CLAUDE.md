# lanscape-ui — React UI for LANScape

`lanscape-ui` is the frontend for LANScape, a portable local-network scanner. It's a **React 19 + TypeScript** app bundled with **Vite**, wrapped in **Electron** for desktop distribution, and it consumes real-time scan data from the Python `py-net-scan` backend via WebSocket.

## Repo layout

- `src/` — React source.
  - `src/components/` — UI components (e.g. `Overview`, `DeviceTable`, `DeviceModal`, `About`, `Footer`). Each folder has an `index.ts` barrel.
  - `src/assets/` — icons, images, static assets.
- `public/` — static assets copied verbatim at build (favicons, `ws-test.html`, manifest).
- `scripts/` — node/python utility scripts (`stamp-version.js`, `rename-cjs.js`, `tag_release.py`).
- `backend/` — per-OS pre-built `lanscape-backend` binaries embedded via `electron-builder` `extraResources`.
- `.github/workflows/` — `electron-build.yml` and `webapp-build.yml` handle CI builds.
- `dist/` — Vite output. `dist-electron/` — compiled Electron main.
- `release/` — `electron-builder` artifacts.

## Stack

- **React 19** with hooks. No class components.
- **TypeScript** 5.9, strict mode via `tsconfig.app.json` / `tsconfig.electron.json`.
- **Vite** 7 for dev/build; `vite-plugin-pwa` for PWA support; `@vitejs/plugin-basic-ssl` for HTTPS dev.
- **Electron** 33, packaged via `electron-builder` (NSIS + portable on Windows, DMG/zip on macOS, AppImage/deb/rpm/tar.gz on Linux).
- **Styling**: Sass modules.
- **State**: `zustand`.
- **DnD**: `@dnd-kit/*`.
- **Motion**: `framer-motion`.
- **Monaco editor** and **react-markdown** for rich content.

## Scripts (from `package.json`)

- `npm run dev` — Vite dev server.
- `npm run dev:electron` — Vite + Electron side-by-side.
- `npm run build` — stamp version, typecheck app, Vite build.
- `npm run build:electron` — compile Electron main, rename to `.cjs`.
- `npm run build:all` — web + electron.
- `npm run typecheck` — `tsc -b`.
- `npm run lint` — ESLint on the whole repo.
- `npm run electron` — build electron and run it.
- `npm run dist[:win|:mac|:linux]` — full packaged distribution.

## Definition of done

Every change should:

1. Pass `/typecheck` (`tsc -b` clean).
2. Pass `/lint` (ESLint clean).
3. Build without errors (`npm run build`). For Electron changes, also `npm run build:electron`.
4. Avoid regressions in the dev server — verify the affected feature in `npm run dev` at least once for UI changes.
5. If you changed the WebSocket protocol assumptions, cross-check the backend schemas in the sibling `py-net-scan` repo (WebSocket messages are the contract between the two).

## Agents and commands

Role-specific context lives in `.claude/agents/`:

- **coder** (`.claude/agents/coder.md`) — implementation work (components, hooks, store, styling).
- **reviewer** (`.claude/agents/reviewer.md`) — PR code review focused on security, efficiency, and temp hacks.

Reusable workflows are slash commands in `.claude/commands/`:

- `/lint` — run ESLint and fix findings.
- `/typecheck` — run `tsc -b` and fix TypeScript errors.
- `/build` — full build + electron build, surface any failures.
- `/summarize-changes` — summarize current branch diff vs `main`.

## Related sibling project

The Python backend lives in `py-net-scan` (next to this repo). The WebSocket server there is the source of truth for scan messages; when in doubt about an incoming message shape, read `lanscape/__init__.py` and `docs/wiki/` over there rather than guessing.
