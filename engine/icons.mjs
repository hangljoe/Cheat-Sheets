// Replace <i data-icon="name"></i> with the inline Lucide SVG (2,000+ icons,
// browse at https://lucide.dev/icons). Extra classes on the <i> are kept.
import fs from 'node:fs';
import path from 'node:path';

export function inlineIcons(html, root) {
  const dir = path.join(root, 'node_modules/lucide-static/icons');
  const missing = [];
  const out = html.replace(/<i\s+([^>]*?)data-icon="([a-z0-9-]+)"([^>]*)>\s*<\/i>/g, (_, pre, name, post) => {
    const file = path.join(dir, `${name}.svg`);
    if (!fs.existsSync(file)) { missing.push(name); return `<span class="icon icon-missing" title="${name}"></span>`; }
    const cls = /class="([^"]*)"/.exec(pre + post)?.[1] ?? '';
    return fs.readFileSync(file, 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s(width|height)="24"/g, '')
      .replace('class="lucide', `aria-hidden="true" class="icon ${cls} lucide`)
      .trim();
  });
  return { html: out, missing };
}
