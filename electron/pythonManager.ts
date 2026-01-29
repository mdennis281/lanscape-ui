/**
 * Python environment manager for LANscape Electron app.
 * 
 * Handles:
 * - Creating/managing a Python virtual environment
 * - Installing LANscape package with version pinning
 * - Starting/stopping the WebSocket server
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// LANscape version to install - update this when releasing new versions
export const LANSCAPE_VERSION = '==2.4.0b1';

// For development: set to local lanscape path to install from source
// Set to null for production (installs from PyPI)
export const LANSCAPE_DEV_PATH: string | null = 'C:\\Users\\Michael\\projects\\py-net-scan';

export class PythonManager extends EventEmitter {
  private envPath: string;
  private lanscapeVersion: string;
  private wsProcess: ChildProcess | null = null;
  private wsPort: number = 8766;
  private initialized: boolean = false;
  private serverRunning: boolean = false;

  constructor(envPath: string, lanscapeVersion: string = LANSCAPE_VERSION) {
    super();
    this.envPath = envPath;
    this.lanscapeVersion = lanscapeVersion;
  }

  /**
   * Get the path to the Python executable in the venv
   */
  private getPythonPath(): string {
    if (process.platform === 'win32') {
      return path.join(this.envPath, 'Scripts', 'python.exe');
    }
    return path.join(this.envPath, 'bin', 'python');
  }

  /**
   * Get the path to pip in the venv
   */
  private getPipPath(): string {
    if (process.platform === 'win32') {
      return path.join(this.envPath, 'Scripts', 'pip.exe');
    }
    return path.join(this.envPath, 'bin', 'pip');
  }

  /**
   * Check if the virtual environment exists
   */
  private venvExists(): boolean {
    return fs.existsSync(this.getPythonPath());
  }

  /**
   * Find system Python 3.10+
   */
  private findSystemPython(): string | null {
    const pythonCommands = process.platform === 'win32'
      ? ['python', 'python3', 'py -3']
      : ['python3', 'python'];

    for (const cmd of pythonCommands) {
      try {
        const result = execSync(`${cmd} --version`, { 
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        // Parse version: "Python 3.x.x"
        const match = result.match(/Python (\d+)\.(\d+)/);
        if (match) {
          const major = parseInt(match[1], 10);
          const minor = parseInt(match[2], 10);
          if (major >= 3 && minor >= 10) {
            console.log(`Found Python ${major}.${minor} at: ${cmd}`);
            return cmd;
          }
        }
      } catch {
        // Command not found, try next
      }
    }
    return null;
  }

  /**
   * Create the virtual environment
   */
  private async createVenv(): Promise<void> {
    this.emit('status', 'Creating Python virtual environment...');

    const python = this.findSystemPython();
    if (!python) {
      throw new Error(
        'Python 3.10 or higher is required. Please install Python from https://python.org'
      );
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(this.envPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const args = ['-m', 'venv', this.envPath];
      const proc = spawn(python, args, { shell: true });

      let stderr = '';
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          console.log('Virtual environment created successfully');
          resolve();
        } else {
          reject(new Error(`Failed to create venv: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn Python: ${err.message}`));
      });
    });
  }

  /**
   * Install or upgrade LANscape in the virtual environment
   */
  private async installLanscape(): Promise<void> {
    this.emit('status', 'Installing LANscape...');

    const pip = this.getPipPath();
    
    // Use dev path if available, otherwise install from PyPI
    let packageSpec: string;
    if (LANSCAPE_DEV_PATH && fs.existsSync(LANSCAPE_DEV_PATH)) {
      packageSpec = LANSCAPE_DEV_PATH;
      console.log(`Installing LANscape from dev path: ${packageSpec}`);
    } else {
      packageSpec = `lanscape${this.lanscapeVersion}`;
      console.log(`Installing LANscape from PyPI: ${packageSpec}`);
    }

    return new Promise((resolve, reject) => {
      const args = ['install', '--upgrade', packageSpec];
      const proc = spawn(pip, args, { shell: true });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
        console.log('pip:', data.toString().trim());
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
        console.error('pip stderr:', data.toString().trim());
      });

      proc.on('close', (code) => {
        if (code === 0) {
          console.log('LANscape installed successfully');
          resolve();
        } else {
          reject(new Error(`Failed to install LANscape: ${stderr || stdout}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to run pip: ${err.message}`));
      });
    });
  }

  /**
   * Check if LANscape is installed and get its version
   */
  private async getLanscapeVersion(): Promise<string | null> {
    const python = this.getPythonPath();

    return new Promise((resolve) => {
      const proc = spawn(python, ['-c', 'import lanscape; print(lanscape.__version__)'], {
        shell: true,
      });

      let stdout = '';
      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          resolve(null);
        }
      });

      proc.on('error', () => {
        resolve(null);
      });
    });
  }

  /**
   * Initialize the Python environment
   * Creates venv if needed and installs LANscape
   */
  async initialize(): Promise<void> {
    try {
      // Check if venv exists
      if (!this.venvExists()) {
        await this.createVenv();
      } else {
        this.emit('status', 'Python environment found');
      }

      // Check if LANscape is installed
      const version = await this.getLanscapeVersion();
      if (!version) {
        await this.installLanscape();
      } else {
        this.emit('status', `LANscape v${version} ready`);
      }

      this.initialized = true;
      this.emit('ready');
    } catch (error) {
      this.emit('error', String(error));
      throw error;
    }
  }

  /**
   * Start the LANscape WebSocket server
   */
  async startWebSocketServer(port: number = 8766): Promise<void> {
    if (this.wsProcess) {
      console.log('WebSocket server already running');
      return;
    }

    this.wsPort = port;
    const python = this.getPythonPath();

    this.emit('status', 'Starting WebSocket server...');

    return new Promise((resolve, reject) => {
      this.wsProcess = spawn(
        python,
        ['-m', 'lanscape', '--ws-server', '--ws-port', String(port)],
        {
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );

      let startupTimeout: NodeJS.Timeout | null = null;

      this.wsProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('[WS Server]:', output.trim());
        
        // Check if server is ready
        if (output.includes('Starting WebSocket server') || 
            output.includes('WebSocket server started')) {
          if (startupTimeout) {
            clearTimeout(startupTimeout);
          }
          this.serverRunning = true;
          this.emit('status', 'WebSocket server running');
          resolve();
        }
      });

      this.wsProcess.stderr?.on('data', (data) => {
        console.error('[WS Server Error]:', data.toString().trim());
      });

      this.wsProcess.on('close', (code) => {
        console.log(`WebSocket server exited with code ${code}`);
        this.wsProcess = null;
        this.serverRunning = false;
        this.emit('status', 'WebSocket server stopped');
      });

      this.wsProcess.on('error', (err) => {
        console.error('Failed to start WebSocket server:', err);
        this.wsProcess = null;
        this.serverRunning = false;
        reject(err);
      });

      // Timeout for startup - assume success if no error after 5 seconds
      startupTimeout = setTimeout(() => {
        this.serverRunning = true;
        this.emit('status', 'WebSocket server running');
        resolve();
      }, 5000);
    });
  }

  /**
   * Stop the WebSocket server
   */
  async stopWebSocketServer(): Promise<void> {
    if (!this.wsProcess) {
      return;
    }

    return new Promise((resolve) => {
      this.wsProcess!.on('close', () => {
        this.wsProcess = null;
        this.serverRunning = false;
        resolve();
      });

      // Send SIGTERM (or SIGKILL on Windows)
      if (process.platform === 'win32') {
        // On Windows, we need to kill the process tree
        spawn('taskkill', ['/pid', String(this.wsProcess!.pid), '/f', '/t'], {
          shell: true,
        });
      } else {
        this.wsProcess!.kill('SIGTERM');
      }

      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (this.wsProcess) {
          this.wsProcess.kill('SIGKILL');
          this.wsProcess = null;
          this.serverRunning = false;
          resolve();
        }
      }, 5000);
    });
  }

  /**
   * Restart the WebSocket server
   */
  async restartWebSocketServer(): Promise<void> {
    await this.stopWebSocketServer();
    await this.startWebSocketServer(this.wsPort);
  }

  /**
   * Reinstall LANscape (useful for updates)
   */
  async reinstallLanscape(): Promise<void> {
    await this.stopWebSocketServer();
    await this.installLanscape();
    await this.startWebSocketServer(this.wsPort);
  }

  /**
   * Clean shutdown
   */
  async shutdown(): Promise<void> {
    await this.stopWebSocketServer();
  }

  /**
   * Get the WebSocket server port
   */
  getWebSocketPort(): number {
    return this.wsPort;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if server is running
   */
  isServerRunning(): boolean {
    return this.serverRunning;
  }
}
