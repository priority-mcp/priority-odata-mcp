import { build } from 'esbuild';
import { readdirSync, statSync, cpSync, rmSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Clean dist directory
const distDir = join(__dirname, 'dist');
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}
mkdirSync(distDir, { recursive: true });

// Mark all node_modules as external (they'll be loaded at runtime)
// Start with known dependencies
const externalPackages = new Set([
  'express',
  'cors',
  'axios',
  'uuid',
  'http-errors'
]);

// Try to read node_modules and add all packages
try {
  const nodeModulesPath = join(__dirname, 'node_modules');
  if (existsSync(nodeModulesPath)) {
    const nodeModules = readdirSync(nodeModulesPath);
    for (const pkg of nodeModules) {
      if (!pkg.startsWith('.')) {
        if (pkg.startsWith('@')) {
          // For scoped packages, add both the scoped name and wildcard
          externalPackages.add(pkg);
          externalPackages.add(`${pkg}/*`);
        } else {
          externalPackages.add(pkg);
        }
      }
    }
  }
} catch (err) {
  console.warn('Could not read node_modules:', err.message);
}

console.log(`Marking ${externalPackages.size} packages as external`);

// Build with esbuild - bundle entry point
console.log('Building with esbuild...');
await build({
  entryPoints: ['src/index.js'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/index.js',
  external: Array.from(externalPackages),
  logLevel: 'info',
  minify: false,
  sourcemap: false,
});

// Copy all non-JS files from src to dist, maintaining structure
function copyNonJSFiles(src, dest) {
  if (!existsSync(src)) return;
  
  const entries = readdirSync(src);
  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);
    
    if (stat.isDirectory()) {
      // Recursively copy directories (except node_modules, dist, .git)
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') {
        continue;
      }
      if (!existsSync(destPath)) {
        mkdirSync(destPath, { recursive: true });
      }
      copyNonJSFiles(srcPath, destPath);
    } else {
      // Copy non-JS files
      const ext = extname(entry);
      if (ext !== '.js' && ext !== '.mjs' && ext !== '.ts' && ext !== '.tsx') {
        cpSync(srcPath, destPath);
      }
    }
  }
}

// Copy config and data directories
const configDir = join(__dirname, 'config');
const dataDir = join(__dirname, 'data');
if (existsSync(configDir)) {
  const destConfig = join(distDir, 'config');
  mkdirSync(destConfig, { recursive: true });
  cpSync(configDir, destConfig, { recursive: true });
}
if (existsSync(dataDir)) {
  const destData = join(distDir, 'data');
  mkdirSync(destData, { recursive: true });
  cpSync(dataDir, destData, { recursive: true });
}

console.log('✅ Build completed successfully');

