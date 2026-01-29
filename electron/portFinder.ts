/**
 * Port finder utility for LANscape Electron app.
 * 
 * Finds an available port starting from a base port.
 */

import * as net from 'net';

const DEFAULT_START_PORT = 8766;
const MAX_PORT_ATTEMPTS = 100;

/**
 * Check if a port is available (not in use)
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        // Other errors - assume port is not available
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });

    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find an available port starting from the given port.
 * 
 * @param startPort - The port to start searching from (default: 8766)
 * @param maxAttempts - Maximum number of ports to try (default: 100)
 * @returns The first available port found
 * @throws Error if no available port found within the range
 */
export async function findAvailablePort(
  startPort: number = DEFAULT_START_PORT,
  maxAttempts: number = MAX_PORT_ATTEMPTS
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const available = await isPortAvailable(port);
    
    if (available) {
      console.log(`Found available port: ${port}`);
      return port;
    }
    
    console.log(`Port ${port} is in use, trying next...`);
  }

  throw new Error(
    `Could not find an available port in range ${startPort}-${startPort + maxAttempts - 1}`
  );
}

/**
 * Default export for convenience
 */
export default findAvailablePort;
