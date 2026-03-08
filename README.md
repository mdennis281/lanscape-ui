# lanscape-ui

Web frontend for [LANscape](https://github.com/mdennis281/LANscape) — a local network scanner and device discovery tool.

The production build (`dist/`) is bundled directly into the [LANscape Python package](https://pypi.org/project/lanscape/) and served by its built-in WebSocket server. An Electron wrapper also exists for standalone desktop distribution but is not the primary target.

## Getting Started

### Prerequisites

- Node.js 20+
- A running [LANscape](https://github.com/mdennis281/LANscape) backend (`lanscape serve`)

### Install & Run

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` and connects to the LANscape WebSocket backend.

### Connecting to the Backend

The WebSocket URL is resolved in this order:

1. **Query parameter** — `?ws-server=host:port` (e.g. `?ws-server=192.168.1.100:8766`)
2. **Environment variable** — `VITE_WS_URL=ws://host:port`
3. **Same-origin** — if none of the above are set, the UI infers the WebSocket URL from `window.location`
4. **Fallback** — `ws://localhost:8766`

During development you can point at any backend instance:

```
http://localhost:5173?ws-server=192.168.1.50:8766
```

### Build

```bash
# Web app only (output: dist/)
npm run build

# Web app + Electron main process
npm run build:all
```

### Other Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production web build |
| `npm run build:electron` | Compile Electron main process |
| `npm run build:all` | Web + Electron build |
| `npm run typecheck` | Full type check (all tsconfigs) |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build locally |
| `npm run dist` | Package Electron app for current platform |

## Project Structure

```
lanscape-ui/
  src/
    components/      # React UI components
    services/        # WebSocket client & presets
    store/           # Zustand stores (connection, scan, ui)
    types/           # TypeScript type definitions
    utils/           # Helpers (URL resolution, version formatting)
    styles/          # SCSS (variables, layout, component partials)
  electron/          # Electron main process (secondary target)
    main.ts          # App entry point & window management
    preload.ts       # IPC bridge
    pythonManager.ts # Python venv / backend lifecycle
  scripts/           # Build utilities
  backend/           # Platform-specific backend binaries (Electron)
```

## Tech Stack

- **React 19** + **TypeScript 5.9** — UI framework
- **Vite 7** — bundler & dev server
- **Zustand** — lightweight state management
- **SCSS** — styling with CSS custom properties
- **PWA** — installable via service worker (vite-plugin-pwa)
- **Electron** (optional) — desktop distribution with bundled Python backend

## Releasing

Releases are built via GitHub Actions when a version tag is pushed.

```bash
python scripts/tag_release.py
```

This stamps `package.json` with a date-based version, creates a git tag, and pushes it.

## License

MIT
