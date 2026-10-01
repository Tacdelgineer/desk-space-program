// Builds dist/ at the repo root: one self-contained page per live mission, plus a hub page, and labs/assets/ as files.
//   node labs/build.mjs
// Local <script src>, <link rel="stylesheet"> and data-file <script src> tags are inlined. Anything
// on the web (three.js, fonts) is left as it is. No packages needed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const labs = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(labs, '..', 'dist');
const read = f => fs.readFileSync(f, 'utf8');
const isLocal = ref => !/^([a-z][a-z0-9+.-]*:)?\/\//i.test(ref) && !/^data:/i.test(ref);
const html = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Text that goes inside <script> or <style> must not close it early.
function safe(text, file, closer) {
  if (/<!--/.test(text)) throw new Error(`${file} contains "<!--", which is not safe inside an inline <script>`);
  return text.replace(new RegExp('</(' + closer + ')', 'gi'), '<\\/$1');
}

function inline(page, dir) {
  page = page.replace(/<script\b([^>]*?)\ssrc="([^"]+)"([^>]*)><\/script>/g, (tag, before, src, after) => {
    if (!isLocal(src)) return tag;
    const file = path.resolve(dir, src), attrs = (before + after).trim();
    let text = read(file);
    if (/type="application\/json"/.test(attrs)) text = JSON.stringify(JSON.parse(text)); // also checks the JSON is valid
    return `<script${attrs ? ' ' + attrs : ''}>${safe(text, src, 'script')}</script>`;
  });
  return page.replace(/<link\b[^>]*\brel="stylesheet"[^>]*>/g, tag => {
    const href = (tag.match(/\bhref="([^"]+)"/) || [])[1];
    if (!href || !isLocal(href)) return tag;
    return `<style>${safe(read(path.resolve(dir, href)), href, 'style')}</style>`;
  });
}

// Every page gets the link preview (labs/assets/preview.png, made by scripts/preview.mjs) unless it names its own.
const SITE = 'https://tacdelgineer.github.io/desk-space-program/';
function preview(page, rel) {
  if (/property="og:image"/.test(page)) return page;
  const title = (page.match(/<title>([^<]*)<\/title>/) || [])[1] || 'Desk Space Program';
  const desc = (page.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  const img = SITE + 'assets/preview.png', url = SITE + rel.replace(/index\.html$/, '');
  const tags = [['og:type', 'website'], ['og:site_name', 'Desk Space Program'], ['og:title', title], ['og:description', desc], ['og:url', url],
    ['og:image', img], ['og:image:width', '1200'], ['og:image:height', '630'], ['og:image:alt', 'An opened-up DGX Spark on a display stand, a coffee mug beside it and a mission control console in front']]
    .map(([k, v]) => `<meta property="${k}" content="${v}">`)
    .concat([['twitter:card', 'summary_large_image'], ['twitter:title', title], ['twitter:description', desc], ['twitter:image', img]].map(([k, v]) => `<meta name="${k}" content="${v}">`));
  return page.replace('</title>', '</title>\n' + tags.join('\n'));
}

const missions = JSON.parse(read(path.join(labs, 'data', 'missions.json'))).missions;
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
const written = [];
const write = (rel, text) => { if (rel.endsWith('.html')) text = preview(text, rel); const f = path.join(dist, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); written.push([rel, Buffer.byteLength(text)]); };
// images and other files pages link to by URL (not inlined): labs/assets/ -> dist/assets/
fs.cpSync(path.join(labs, 'assets'), path.join(dist, 'assets'), { recursive: true });

// one page per live mission
for (const m of missions.filter(x => x.status === 'live')) {
  const dir = path.join(labs, 'missions', m.dir);
  if (!fs.existsSync(path.join(dir, 'index.html'))) throw new Error(`data/missions.json says ${m.n} is live, but labs/missions/${m.dir}/index.html is missing`);
  write(`${m.dir}/index.html`, inline(read(path.join(dir, 'index.html')), dir));
}
for (const d of fs.readdirSync(path.join(labs, 'missions'))) {
  if (!missions.some(m => m.dir === d && m.status === 'live')) console.warn(`warning: labs/missions/${d} is not listed as live in data/missions.json, so it was not built`);
}

// the hub
const items = missions.map(m => {
  const body = `<span class="n">${html(m.n)}</span><span class="body"><span class="t">${html(m.title)}</span><span class="q">${html(m.question)}</span></span><span class="tag">${m.status === 'live' ? 'Live' : 'Coming'}</span>`;
  return m.status === 'live' ? `    <li class="live"><a href="${html(m.dir)}/">${body}</a></li>` : `    <li>${body}</li>`;
}).join('\n');
const hubDir = path.join(labs, 'hub');
const template = read(path.join(hubDir, 'index.html'));
if (!template.includes('<!--missions-->')) throw new Error('labs/hub/index.html needs a <!--missions--> marker');
write('index.html', inline(template.replace('<!--missions-->', items), hubDir));

for (const [rel, bytes] of written) console.log(`dist/${rel}  ${(bytes / 1024).toFixed(1)} KB`);
