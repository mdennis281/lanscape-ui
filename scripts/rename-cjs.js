/**
 * Renames Electron build output files from .js to .cjs
 * This is needed because the project uses "type": "module" in package.json
 * but Electron main process needs CommonJS.
 */

import { readdirSync, renameSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const distDir = join(import.meta.dirname, '..', 'dist-electron');

// Get all .js files
const jsFiles = readdirSync(distDir).filter(f => f.endsWith('.js'));

// First, update require statements in all files to use .cjs
for (const file of jsFiles) {
  const filePath = join(distDir, file);
  let content = readFileSync(filePath, 'utf-8');
  
  // Update require paths from .js to .cjs (or add .cjs if no extension)
  content = content.replace(/require\("\.\/(\w+)"\)/g, 'require("./$1.cjs")');
  content = content.replace(/require\("\.\/(\w+)\.js"\)/g, 'require("./$1.cjs")');
  
  writeFileSync(filePath, content);
}

// Then rename files
for (const file of jsFiles) {
  const oldPath = join(distDir, file);
  const newPath = join(distDir, file.replace('.js', '.cjs'));
  renameSync(oldPath, newPath);
  console.log(`Renamed: ${file} -> ${file.replace('.js', '.cjs')}`);
}

console.log('Electron build files renamed to .cjs');
