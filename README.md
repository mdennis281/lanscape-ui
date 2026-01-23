# LANscape React UI# React + TypeScript + Vite



A modern React-based frontend for LANscape network scanner, connecting via WebSocket for real-time updates.This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.



## FeaturesCurrently, two official plugins are available:



- **Real-time scanning**: Watch devices appear as they're discovered- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh

- **Delta updates**: Efficient updates - only changed data is transmitted- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

- **Responsive design**: Works on desktop and mobile

- **PWA support**: Installable as a Progressive Web App## React Compiler

- **Dark theme**: Sleek dark interface matching the original Flask UI

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Getting Started

## Expanding the ESLint configuration

### Prerequisites

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

- Node.js 18+

- LANscape WebSocket server running on port 8766```js

export default defineConfig([

### Installation  globalIgnores(['dist']),

  {

```bash    files: ['**/*.{ts,tsx}'],

# Install dependencies    extends: [

npm install      // Other configs...



# Start development server      // Remove tseslint.configs.recommended and replace with this

npm run dev      tseslint.configs.recommendedTypeChecked,

```      // Alternatively, use this for stricter rules

      tseslint.configs.strictTypeChecked,

### Configuration      // Optionally, add this for stylistic rules

      tseslint.configs.stylisticTypeChecked,

Create a `.env` file (or copy `.env.example`) to configure:

      // Other configs...

```env    ],

# WebSocket server URL    languageOptions: {

VITE_WS_URL=ws://localhost:8766      parserOptions: {

```        project: ['./tsconfig.node.json', './tsconfig.app.json'],

        tsconfigRootDir: import.meta.dirname,

### Building for Production      },

      // other options...

```bash    },

npm run build  },

```])

```

The built files will be in the `dist/` directory.

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

## Architecture

```js

### Project Structure// eslint.config.js

import reactX from 'eslint-plugin-react-x'

```import reactDom from 'eslint-plugin-react-dom'

src/

├── components/       # React componentsexport default defineConfig([

│   ├── Header/       # Top navigation with subnet input  globalIgnores(['dist']),

│   ├── Overview/     # Status cards (devices, runtime, stage)  {

│   ├── DeviceTable/  # Device listing with filtering    files: ['**/*.{ts,tsx}'],

│   ├── DeviceModal/  # Device details with port scanning    extends: [

│   ├── Settings/     # Scan configuration modal      // Other configs...

│   ├── About/        # App info modal      // Enable lint rules for React

│   ├── Modal/        # Reusable modal component      reactX.configs['recommended-typescript'],

│   └── Footer/       # App footer      // Enable lint rules for React DOM

├── services/         # WebSocket service layer      reactDom.configs.recommended,

├── store/            # Zustand state management    ],

├── types/            # TypeScript type definitions    languageOptions: {

└── styles/           # CSS styles      parserOptions: {

```        project: ['./tsconfig.node.json', './tsconfig.app.json'],

        tsconfigRootDir: import.meta.dirname,

### State Management      },

      // other options...

Uses [Zustand](https://github.com/pmndrs/zustand) for lightweight global state:    },

  },

- Connection status])

- Scan configuration```

- Scan status & results
- UI state (modals, selection)

### WebSocket Protocol

Connects to LANscape WebSocket server using JSON protocol:

- **Requests**: `{ type: "request", handler, action, data }`
- **Responses**: `{ type: "response", handler, action, success, data }`
- **Events**: `{ type: "event", handler, event, data }`
- **Errors**: `{ type: "error", handler, action, code, message }`

### Available WebSocket Actions

#### Scan Handler
- `start_scan` - Start a network scan
- `stop_scan` - Stop running scan
- `get_results` - Get current scan results
- `get_status` - Get scan status
- `get_config` / `set_config` - Manage scan configuration
- `subscribe` / `unsubscribe` - Real-time delta updates

#### Port Handler
- `scan_ports` - Scan ports on a specific IP
- `get_common_ports` - Get list of common ports

#### Tools Handler
- `get_app_info` - Get application info
- `get_version` - Get current version
- `check_updates` - Check for updates
- `parse_cidr` - Parse CIDR notation
- `lookup_mac` - MAC address vendor lookup
- `dns_lookup` - DNS resolution

## Development

### Type Checking

```bash
npx tsc --noEmit
```

### Linting

```bash
npm run lint
```

## License

MIT
