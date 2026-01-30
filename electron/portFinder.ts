/**
 * Port finder utility for LANscape Electron app.
 * 
 * Finds an available port starting from a base port and reserves it
 * until released (to prevent race conditions with multiple instances).
 */

import * as net from 'net';

const DEFAULT_START_PORT = 8766;
const MAX_PORT_ATTEMPTS = 100;

// Store reserved port servers so we can release them later
let reservedServer: net.Server | null = null;

/**
 * Result of reserving a port - includes the port number and a release function
 */
export interface ReservedPort {
  port: number;
  release: () => Promise<void>;
}

/**
 * Try to reserve a specific port by binding to it.
 * Returns the server if successful, null if port is in use.
 */
function tryReservePort(port: number): Promise<net.Server | null> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(null);
      } else {
        // Other errors - assume port is not available
        console.error(`Error checking port ${port}:`, err.message);
        resolve(null);
      }
    });

    server.once('listening', () => {
      // Don't close - keep it reserved!
      resolve(server);
    });

    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find and RESERVE an available port starting from the given port.
 * The port will remain reserved (bound) until release() is called.
 * This prevents race conditions when multiple instances start simultaneously.
 * 
 * @param startPort - The port to start searching from (default: 8766)
 * @param maxAttempts - Maximum number of ports to try (default: 100)
 * @returns ReservedPort object with port number and release function
 * @throws Error if no available port found within the range
 */
export async function findAndReservePort(
  startPort: number = DEFAULT_START_PORT,
  maxAttempts: number = MAX_PORT_ATTEMPTS
): Promise<ReservedPort> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const server = await tryReservePort(port);
    
    if (server) {
      console.log(`Reserved port: ${port}`);
      reservedServer = server;
      
      return {
        port,
        release: () => new Promise<void>((resolve) => {
          server.close(() => {
            console.log(`Released port: ${port}`);
            if (reservedServer === server) {
              reservedServer = null;
            }
            resolve();
          });
        }),
      };
    }
    
    console.log(`Port ${port} is in use, trying next...`);
  }

  throw new Error(
    `Could not find an available port in range ${startPort}-${startPort + maxAttempts - 1}`
  );
}

/**
 * Legacy function for backward compatibility - finds available port but doesn't reserve it.
 * WARNING: This has a race condition if multiple instances start simultaneously.
 * Prefer findAndReservePort() instead.
 * 
 * @deprecated Use findAndReservePort() instead
 */
export async function findAvailablePort(
  startPort: number = DEFAULT_START_PORT,
  maxAttempts: number = MAX_PORT_ATTEMPTS
): Promise<number> {
  const reserved = await findAndReservePort(startPort, maxAttempts);
  // Immediately release - this is the old behavior with race condition
  await reserved.release();
  return reserved.port;
}

/**
 * Default export for convenience
 */
export default findAndReservePort;
