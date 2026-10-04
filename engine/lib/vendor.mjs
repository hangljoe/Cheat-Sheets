// Browser bundle of mermaid-to-excalidraw, built on first use with esbuild.
// The package ships bare imports (mermaid, nanoid, …) a browser can't resolve,
// so it is bundled once into engine/vendor/ (git-ignored) and reused.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Rebuilt whenever any stamp file is newer than the bundle. The lockfile is a
// stamp because transitive upgrades (e.g. security overrides) never touch the
// package's own package.json.
const inFlight = new Map();   // outFile → promise, so concurrent variant builds share one bundling

export function ensureMermaidBundle(root, outFile = path.join(root, 'engine/vendor/mermaid-to-excalidraw.js'), stampFiles) {
  if (!inFlight.has(outFile)) {
    inFlight.set(outFile, bundle(root, outFile, stampFiles).finally(() => inFlight.delete(outFile)));
  }
  return inFlight.get(outFile);
}

let tmpCounter = 0;
async function bundle(
  root,
  outFile,
  stampFiles = [
    path.join(root, 'node_modules/@excalidraw/mermaid-to-excalidraw/package.json'),
    path.join(root, 'package-lock.json'),
    fileURLToPath(import.meta.url),   // entry / esbuild options live here
  ],
) {
  const newest = Math.max(...stampFiles.filter((f) => fs.existsSync(f)).map((f) => fs.statSync(f).mtimeMs));
  if (fs.existsSync(outFile) && fs.statSync(outFile).mtimeMs >= newest) return outFile;
  const { build } = await import('esbuild');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  // Build to a temp file and rename, so a concurrent build never imports half a bundle.
  const tmp = `${outFile}.${process.pid}.${++tmpCounter}.tmp`;
  try {
    await build({
    stdin: {
      contents: "export { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw';",
      resolveDir: root, loader: 'js',
    },
    bundle: true, format: 'esm', minify: true, outfile: tmp, logLevel: 'warning',
    });
    fs.renameSync(tmp, outFile);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  return outFile;
}
