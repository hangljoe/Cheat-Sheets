// Tiny static server so the headless page can fetch fonts, icons, styles and
// .excalidraw files. Serves files under `root` plus in-memory HTML routes.
// Assumption: bound to loopback on an ephemeral port for the lifetime of one
// build only — it is not hardened for anything longer-lived or non-local.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.excalidraw': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.mmd': 'text/plain' };

// docRoutes: Map(urlPath → html string), e.g. new Map([['/__sheet', doc]]).
export async function startServer(root, docRoutes = new Map()) {
  const server = http.createServer((req, res) => {
    const fail = (code) => { if (!res.headersSent) res.writeHead(code); res.end(); };
    try {
      let url;
      try { url = decodeURIComponent(req.url.split('?')[0]); } catch { return fail(400); } // e.g. a lone '%'
      if (url.includes('\0')) return fail(400);
      if (docRoutes.has(url)) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(docRoutes.get(url)); }
      const file = path.join(root, url);
      const inside = file === root || file.startsWith(root + path.sep);
      if (!inside || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return fail(404);
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch {
      fail(500);
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}
