/**
 * Generates a date-based version string and writes it to package.json.
 *
 * Format: YYYY.MM.DD.SSSSS
 *   - YYYY.MM.DD from the current UTC date
 *   - SSSSS is the number of seconds since midnight UTC, zero-padded to 5 digits
 *     (max 86399, always fits in 5 digits)
 *
 * Examples:
 *   00:00:00 UTC -> 00000
 *   00:01:00 UTC -> 00060
 *   12:00:00 UTC -> 43200
 *   23:59:59 UTC -> 86399
 *
 * Usage:
 *   node scripts/stamp-version.js          # stamp with current UTC time
 *   node scripts/stamp-version.js --dry    # print without writing
 *   node scripts/stamp-version.js --force  # stamp even if already date-based
 *
 * In CI the committed package.json already contains the correct version
 * (stamped by tag_release.py), so this script is a no-op unless --force is set.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagePath = resolve(__dirname, '..', 'package.json');

const DATE_VERSION_RE = /^\d{4}\.\d{2}\.\d{2}\.\d{5}$/;

function generateVersion() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const secondsSinceMidnight = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
  const build = String(secondsSinceMidnight).padStart(5, '0');
  return `${yyyy}.${mm}.${dd}.${build}`;
}

const isDry = process.argv.includes('--dry');
const isForce = process.argv.includes('--force');

if (isDry) {
  console.log(generateVersion());
  process.exit(0);
}

const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));

// Skip if already stamped (CI builds from a tagged commit)
if (!isForce && DATE_VERSION_RE.test(pkg.version)) {
  console.log(`Version already stamped: ${pkg.version} (use --force to override)`);
  process.exit(0);
}

const version = generateVersion();
pkg.version = version;
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`Stamped version: ${version}`);
