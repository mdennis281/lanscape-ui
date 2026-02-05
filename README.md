# LANscape Desktop

A cross-platform desktop application for scanning and monitoring local network devices. Built with Electron and React, LANscape Desktop provides a modern interface for the [LANscape](https://github.com/mdennis281/LANscape) network scanning library.

## How It Works

LANscape Desktop bundles the LANscape Python backend as a standalone executable. When the application starts, it launches the backend process which handles all network scanning operations. The frontend communicates with the backend over WebSocket, receiving real-time updates as devices are discovered on the network.

The scanning process:
1. Backend performs ARP scans to discover active hosts
2. Open ports are detected via TCP connection attempts
3. Service identification probes known ports for banners and signatures
4. Results stream to the frontend in real-time via WebSocket

## Backend

The network scanning functionality comes from the [LANscape PyPI package](https://pypi.org/project/lanscape/). This is a Python library that provides:

- ARP-based host discovery
- TCP port scanning with configurable ranges
- Service identification using protocol probes
- MAC address vendor lookup
- Hostname resolution via mDNS and NetBIOS

For desktop distribution, the Python backend is compiled into a standalone executable using PyInstaller. This allows the app to run without requiring Python to be installed on the user's system.

Source: https://github.com/mdennis281/LANscape

## Building

### Prerequisites

- Node.js 20+
- npm

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run Electron in development
npm run electron
```

### Production Build

```bash
# Build for current platform
npm run dist

# Build for specific platform
npm run dist:win
npm run dist:mac
npm run dist:linux
```

Output files are placed in the `release/` directory.

## Project Structure

```
lanscape-ui/
  electron/          # Electron main process
    main.ts          # Application entry point
    preload.ts       # Preload script for IPC
    pythonManager.ts # Backend process management
    portFinder.ts    # Dynamic port allocation
  src/               # React frontend
    components/      # UI components
    services/        # API and WebSocket clients
    store/           # State management
    types/           # TypeScript definitions
  backend/           # Platform-specific backend binaries
    win/
    mac/
    linux/
```

## Releases

Releases are built automatically via GitHub Actions when a version tag is pushed. The workflow builds for Windows, macOS (Apple Silicon), and Linux, then publishes the artifacts as a GitHub release.

To create a release:

```powershell
# Run the release task in VS Code, or:
./scripts/tag_release.ps1 1.0.0
```

For pre-releases, use semver suffixes:

```powershell
./scripts/tag_release.ps1 1.0.0-beta.1
```

## License

MIT
