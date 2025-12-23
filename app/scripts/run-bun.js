#!/usr/bin/env node
/**
 * Cross-platform bun launcher that finds bun in various locations
 */
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

function findBun() {
  const isWindows = process.platform === 'win32';
  const bunName = isWindows ? 'bun.exe' : 'bun';

  // Potential bun locations
  const locations = [
    // User's home .bun installation (common for Windows/Mac/Linux)
    path.join(os.homedir(), '.bun', 'bin', bunName),
    // Local node_modules
    path.join(process.cwd(), 'node_modules', '.bin', bunName),
    path.join(process.cwd(), 'node_modules', 'bun', 'bin', bunName),
    // Global npm location
    path.join(process.env.APPDATA || '', 'npm', bunName),
    // nvm4w location
    path.join(process.env.NVM_HOME || 'C:\\nvm4w', 'nodejs', 'node_modules', 'bun', 'bin', bunName),
  ];

  // Try each location
  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      return loc;
    }
  }

  // Try to find bun in PATH using 'where' (Windows) or 'which' (Unix)
  try {
    const cmd = isWindows ? 'where bun' : 'which bun';
    const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const paths = result.trim().split(/\r?\n/);

    for (const p of paths) {
      // On Windows, verify the path isn't the broken wrapper
      if (isWindows) {
        // Check if this is a real executable, not a shell script
        if (p.endsWith('.exe') && fs.existsSync(p)) {
          return p;
        }
      } else if (fs.existsSync(p)) {
        return p;
      }
    }
  } catch (e) {
    // Ignore errors from where/which
  }

  return null;
}

function main() {
  const bunPath = findBun();

  if (!bunPath) {
    console.error('Error: Could not find bun installation.');
    console.error('Please install bun: https://bun.sh/docs/installation');
    console.error('');
    console.error('On Windows, run: powershell -c "irm bun.sh/install.ps1|iex"');
    console.error('On Mac/Linux, run: curl -fsSL https://bun.sh/install | bash');
    process.exit(1);
  }

  console.log(`[run-bun] Using bun at: ${bunPath}`);

  // Get arguments to pass to bun (skip node and this script)
  const args = process.argv.slice(2);

  // Spawn bun with the provided arguments
  const child = spawn(bunPath, args, {
    stdio: 'inherit',
    shell: false,
  });

  child.on('error', (err) => {
    console.error('Failed to start bun:', err.message);
    process.exit(1);
  });

  child.on('close', (code) => {
    process.exit(code || 0);
  });
}

main();
