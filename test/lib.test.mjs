import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { startServer } from '../engine/lib/server.mjs';
import { exitCodeFor, pageUnreadable, stripEngineScripts } from '../engine/lib/build.mjs';

test('stripEngineScripts removes every engine module script and keeps others', () => {
  const html = '<body><script type="module" src="/engine/client/boot.js"></script>' +
    '<script src="/engine/client/other.js" type="module"></script>' +
    '<script type="text/mermaid">flowchart LR; A-->B</script>' +
    '<script src="/node_modules/x.js"></script></body>';
  const out = stripEngineScripts(html);
  assert.doesNotMatch(out, /\/engine\//);
  assert.match(out, /text\/mermaid/);
  assert.match(out, /node_modules\/x\.js/);
});

// Raw request so '..' segments reach the server unnormalised (fetch would collapse them).
function get(base, rawPath) {
  return new Promise((resolve, reject) => {
    const { hostname, port } = new URL(base);
    http.get({ hostname, port, path: rawPath }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body }));
    }).on('error', reject);
  });
}

test('server: serves files, doc routes, and blocks traversal and sibling-prefix dirs', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-srv-'));
  const root = path.join(tmp, 'repo');
  fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(root, 'sub', 'a.css'), 'body{}');
  fs.mkdirSync(path.join(tmp, 'repo-evil'));
  fs.writeFileSync(path.join(tmp, 'repo-evil', 'private.txt'), 'nope');
  fs.writeFileSync(path.join(tmp, 'outside.txt'), 'nope');
  const srv = await startServer(root, new Map([['/__sheet', '<p>doc</p>']]));
  t.after(async () => { await srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

  const css = await get(srv.base, '/sub/a.css');
  assert.equal(css.status, 200);
  assert.equal(css.type, 'text/css');
  assert.equal((await get(srv.base, '/__sheet')).body, '<p>doc</p>');
  assert.equal((await get(srv.base, '/sub')).status, 404);                     // directory
  assert.equal((await get(srv.base, '/missing.css')).status, 404);
  assert.equal((await get(srv.base, '/../outside.txt')).status, 404);           // traversal
  assert.equal((await get(srv.base, '/../repo-evil/private.txt')).status, 404); // sibling prefix
  assert.equal((await get(srv.base, '/assets/50%-off.png')).status, 400);      // malformed escape
  assert.equal((await get(srv.base, '/sub/a.css%00')).status, 400);            // NUL byte
  assert.equal((await get(srv.base, '/sub/a.css')).status, 200);               // server survived
});

test('pageUnreadable: null = no text (ok), undefined = missing (fail), low floor fails', () => {
  const ok = { effectivePt: 7, minTextPt: 6.5, minTextFloorPt: 6 };
  assert.equal(pageUnreadable(ok), false);
  assert.equal(pageUnreadable({ ...ok, minTextPt: null }), false);
  assert.equal(pageUnreadable({ ...ok, minTextPt: undefined }), true);
  assert.equal(pageUnreadable({ ...ok, minTextFloorPt: 2 }), true);
  assert.equal(pageUnreadable({ ...ok, minTextFloorPt: 6 }), false);
  assert.equal(pageUnreadable({ ...ok, minTextFloorPt: undefined }), true);
});

test('exitCodeFor: overflow wins, then unreadable, missing measurements count as unreadable', () => {
  const ok = { overflow: false, effectivePt: 7, minTextPt: 6.5, minTextFloorPt: 6 };
  assert.equal(exitCodeFor({ pages: [ok] }), 0);
  assert.equal(exitCodeFor({ pages: [ok, { ...ok, overflow: true, minTextPt: 4 }] }), 2);
  assert.equal(exitCodeFor({ pages: [{ ...ok, minTextPt: 5.99 }] }), 3);
  assert.equal(exitCodeFor({ pages: [{ ...ok, effectivePt: 5.9 }] }), 3);
  assert.equal(exitCodeFor({ pages: [{ overflow: false, effectivePt: 7, minTextFloorPt: 6 }] }), 3);
  assert.equal(exitCodeFor({ pages: [{ overflow: false, effectivePt: 7, minTextPt: 6.5 }] }), 3); // floor field missing
  assert.equal(exitCodeFor({ pages: [{ ...ok, minTextPt: 6 }] }), 0);
  assert.equal(exitCodeFor({ pages: [ok], figures: { errors: [{ src: 'x' }] } }), 4);
  assert.equal(exitCodeFor({ pages: [ok, ok], auto: true, requestedPages: 1 }), 2);
});

test('buildSheet: injected meta and html override the sheet files (variant seam)', async (t) => {
  const { chromium } = await import('playwright');
  const { buildSheet } = await import('../engine/lib/build.mjs');
  const root = path.resolve(import.meta.dirname, '..');
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const outDir = path.join(root, 'out', 'lib-injected');
  const report = await buildSheet({
    root, sheetDir: path.join(root, 'test/fixtures/fits'), outDir, name: 'lib-injected', browser, flags: new Set(['--no-png']),
    meta: { title: 'Injected', format: 'A6', depth: 1 },
    html: '<section class="page"><div class="card"><h2>Injected card</h2><p>Body.</p></div></section>',
  });
  assert.equal(report.title, 'Injected');
  assert.equal(report.format, 'A6');
  assert.match(fs.readFileSync(path.join(outDir, 'lib-injected.html'), 'utf8'), /Injected card/);
});
