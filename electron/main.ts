/**
 * Electron main process for LANscape UI.
 * 
 * Manages the Python virtual environment and WebSocket server lifecycle.
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { PythonManager, LANSCAPE_VERSION } from './pythonManager';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch {
  // electron-squirrel-startup not installed, ignore
}

let mainWindow: BrowserWindow | null = null;
let pythonManager: PythonManager | null = null;
let wsPort: number = 8766; // Will be set by Python after it selects an available port

// Determine if we're in development mode
// Check if dist/index.html exists - if it does, use production mode even when not packaged
const distIndexPath = path.join(__dirname, '../dist/index.html');
const hasBuiltFiles = fs.existsSync(distIndexPath);
const isDev = process.env.NODE_ENV === 'development' || (!app.isPackaged && !hasBuiltFiles);

/**
 * Get the path to the user data directory where we store the venv
 */
function getAppDataPath(): string {
  return path.join(app.getPath('userData'), 'python-env');
}

/**
 * Create the main application window
 */
async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'LANscape',
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    // Modern look
    backgroundColor: '#262626',
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    await mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Initialize the Python environment and start the WebSocket server
 */
async function initializePython(): Promise<void> {
  const envPath = getAppDataPath();
  pythonManager = new PythonManager(envPath, LANSCAPE_VERSION);

  // Set up IPC handlers for status updates
  pythonManager.on('status', (status: string) => {
    mainWindow?.webContents.send('python-status', status);
  });

  pythonManager.on('error', (error: string) => {
    mainWindow?.webContents.send('python-error', error);
  });

  pythonManager.on('ready', () => {
    mainWindow?.webContents.send('python-ready');
  });

  try {
    await pythonManager.initialize();
    // Let Python auto-select an available port to avoid race conditions
    // Python will report the port it chose via stdout
    wsPort = await pythonManager.startWebSocketServer();
    console.log(`Python WebSocket server running on port ${wsPort}`);
    // Notify the frontend of the actual port
    mainWindow?.webContents.send('ws-port-ready', wsPort);
  } catch (error) {
    console.error('Failed to initialize Python environment:', error);
    mainWindow?.webContents.send('python-error', String(error));
  }
}

/**
 * Set up IPC handlers for renderer process communication
 */
function setupIpcHandlers(): void {
  // Get WebSocket server port - this is set before the window loads
  ipcMain.handle('get-ws-port', () => {
    return wsPort;
  });

  // Get Python environment status
  ipcMain.handle('get-python-status', () => {
    return {
      initialized: pythonManager?.isInitialized() ?? false,
      serverRunning: pythonManager?.isServerRunning() ?? false,
      version: LANSCAPE_VERSION,
      port: wsPort,
    };
  });

  // Restart WebSocket server
  ipcMain.handle('restart-ws-server', async () => {
    try {
      await pythonManager?.restartWebSocketServer();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Reinstall LANscape (useful for updates)
  ipcMain.handle('reinstall-lanscape', async () => {
    try {
      await pythonManager?.reinstallLanscape();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}

// App lifecycle handlers
app.whenReady().then(async () => {
  // Set up IPC handlers
  setupIpcHandlers();
  
  // Create window
  await createWindow();
  
  // Initialize Python - it will auto-select an available port
  await initializePython();

  app.on('activate', async () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, apps typically stay active until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  // Clean up Python processes
  await pythonManager?.shutdown();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
