// SAJHA theme builder (no dependencies).
//
// Reads  src/themes/light/*.css  (Pearl Light 3D UI)
//        src/themes/dark/*.css   (Obsidian Glass 3D UI)
// and writes  src/themes.generated.css  where every rule is scoped under
//        html[data-theme="light"]  /  html[data-theme="dark"]
// so BOTH interfaces live in one bundle and switching is instant.
//
// Runs automatically before `npm run dev` and `npm run build`.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'src');
const THEMES = ['light', 'dark'];
const FILES = ['style.css', 'premium.css', 'glass.css', 'mono.css']; // load order matters (mono.css is optional, dark only)

/* ---------- tiny CSS block parser ---------- */
function skipString(css, i) {
  const q = css[i];
  i++;
  while (i < css.length && css[i] !== q) i += css[i] === '\\' ? 2 : 1;
  return i + 1;
}
function skipComment(css, i) {
  const e = css.indexOf('*/', i + 2);
  return e === -1 ? css.length : e + 2;
}
function parse(css) {
  const nodes = [];
  let i = 0;
  const n = css.length;
  while (i < n) {
    if (/\s/.test(css[i])) { i++; continue; }
    if (css.startsWith('/*', i)) { i = skipComment(css, i); continue; }
    // prelude: up to top-level "{" or ";"
    let start = i, paren = 0, prelude = '';
    while (i < n) {
      const c = css[i];
      if (c === '"' || c === "'") { i = skipString(css, i); continue; }
      if (css.startsWith('/*', i)) { prelude += css.slice(start, i); i = skipComment(css, i); start = i; continue; }
      if (c === '(' || c === '[') paren++;
      else if (c === ')' || c === ']') paren--;
      else if (paren <= 0 && (c === '{' || c === ';')) break;
      i++;
    }
    prelude += css.slice(start, i);
    prelude = prelude.trim();
    if (i >= n) { if (prelude) nodes.push({type: 'stmt', prelude}); break; }
    if (css[i] === ';') { i++; if (prelude) nodes.push({type: 'stmt', prelude}); continue; }
    // block: find matching "}"
    i++;
    const bodyStart = i;
    let depth = 1;
    while (i < n && depth > 0) {
      const c = css[i];
      if (c === '"' || c === "'") { i = skipString(css, i); continue; }
      if (css.startsWith('/*', i)) { i = skipComment(css, i); continue; }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      i++;
    }
    const body = css.slice(bodyStart, i - 1);
    nodes.push({type: prelude.startsWith('@') ? 'at' : 'rule', prelude, body});
  }
  return nodes;
}

/* ---------- selector scoping ---------- */
function splitTopLevel(sel) {
  const out = [];
  let depth = 0, cur = '';
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === '"' || c === "'") { const e = skipString(sel, i); cur += sel.slice(i, e); i = e - 1; continue; }
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out.map(s => s.trim()).filter(Boolean);
}
function scopeSelector(sel, theme) {
  const A = `html[data-theme="${theme}"]`;
  const out = [];
  for (const s of splitTopLevel(sel)) {
    if (/^:root(?![\w-])/.test(s)) out.push(A + s.slice(5));
    else if (/^html(?![\w-])/.test(s)) out.push(A + s.slice(4));
    else if (s.startsWith('::')) out.push(A + s, A + ' ' + s); // e.g. ::-webkit-scrollbar (also hits the page scrollbar)
    else out.push(A + ' ' + s);
  }
  return out.join(',');
}

/* ---------- keyframes: unique names per theme ---------- */
function collectKeyframes(nodes, set = new Set()) {
  for (const nd of nodes) {
    if (nd.type !== 'at') continue;
    const m = nd.prelude.match(/^@(?:-\w+-)?keyframes\s+([\w-]+)/);
    if (m) set.add(m[1]);
    else if (/^@(media|supports|layer)/.test(nd.prelude)) collectKeyframes(parse(nd.body), set);
  }
  return set;
}
function renameAnimations(body, names, theme) {
  if (!names.size) return body;
  return body.replace(/(animation(?:-name)?\s*:)([^;}]*)/g, (m, p, v) => {
    for (const name of names) v = v.replace(new RegExp('(?<![\\w-])' + name + '(?![\\w-])', 'g'), name + '-' + theme);
    return p + v;
  });
}

function scopeNodes(nodes, theme, kf) {
  let out = '';
  for (const nd of nodes) {
    if (nd.type === 'stmt') { out += nd.prelude + ';\n'; continue; }
    if (nd.type === 'rule') {
      out += scopeSelector(nd.prelude, theme) + '{' + renameAnimations(nd.body, kf, theme) + '}\n';
      continue;
    }
    // at-rules
    const p = nd.prelude;
    if (/^@(media|supports|layer)\b/.test(p)) out += p + '{\n' + scopeNodes(parse(nd.body), theme, kf) + '}\n';
    else if (/^@(?:-\w+-)?keyframes\s/.test(p)) out += p.replace(/^(@(?:-\w+-)?keyframes\s+)([\w-]+)/, `$1$2-${theme}`) + '{' + nd.body + '}\n';
    else out += p + '{' + nd.body + '}\n'; // @font-face, @page, ... unchanged
  }
  return out;
}

/* ---------- build ---------- */
let output = `/* AUTO-GENERATED by scripts/build-themes.mjs — do not edit by hand.
   Edit src/themes/light/*.css or src/themes/dark/*.css instead.
   light = Pearl Light 3D UI   ·   dark = Obsidian Glass 3D UI */\n`;
let ruleCount = 0;
for (const theme of THEMES) {
  const parsed = FILES.filter(f => f !== 'mono.css' || fs.existsSync(path.join(src, 'themes', theme, f))).map(f => {
    const file = path.join(src, 'themes', theme, f);
    if (!fs.existsSync(file)) throw new Error('Missing theme file: ' + file);
    return {f, nodes: parse(fs.readFileSync(file, 'utf8'))};
  });
  const kf = new Set();
  parsed.forEach(p => collectKeyframes(p.nodes, kf));
  output += `\n/* ================= ${theme.toUpperCase()} THEME ================= */\n`;
  for (const {f, nodes} of parsed) {
    output += `/* --- ${theme}/${f} --- */\n` + scopeNodes(nodes, theme, kf);
    ruleCount += nodes.length;
  }
}
const target = path.join(src, 'themes.generated.css');
fs.writeFileSync(target, output);
console.log(`[themes] wrote ${path.relative(process.cwd(), target)} (${(output.length / 1024).toFixed(0)} KB, ${ruleCount} top-level blocks)`);
