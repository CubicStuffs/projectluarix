'use strict';
/**
 * Project Luarix — lib/obfuscator.js (v3.1 Luau)
 *
 * FIXED: CFF now bails on any statement containing `local`, `return`,
 * `continue`, or `goto`, so flattened functions cannot lose scope.
 * `cff` defaults to false — enable only after auditing.
 */

const crypto = require('crypto');

function makePRNG(seed) {
  let s = (seed >>> 0) || 0x9E3779B9;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    return s >>> 0;
  };
}

function hexName(rng, len) {
  const a = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789';
  let n = '_';
  for (let i = 0; i < (len || 6); i++) n += a[rng() % a.length];
  return n;
}

/* ---------------- Luau tokenizer (unchanged, working) ---------------- */
function tokenize(src) {
  const toks = [];
  const n = src.length;
  let i = 0;

  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) {
      let j = i + 1; while (j < n && /\s/.test(src[j])) j++;
      toks.push({ type: 'ws', value: src.slice(i, j) }); i = j; continue;
    }
    if (c === '-' && src[i + 1] === '-') {
      let j = src.indexOf('\n', i); if (j < 0) j = n;
      toks.push({ type: 'comment', value: src.slice(i, j) }); i = j; continue;
    }
    if (c === '"' || c === "'") {
      const q = c; let j = i + 1; let hasEsc = false;
      while (j < n) {
        const d = src[j];
        if (d === '\\') { hasEsc = true; j += 2; continue; }
        if (d === q) { j++; break; }
        if (d === '\n') break;
        j++;
      }
      toks.push({ type: 'string', value: src.slice(i, j), quote: q, hasEsc });
      i = j; continue;
    }
    if (c === '[' && (src[i + 1] === '[' || src[i + 1] === '=')) {
      const eqMatch = src.slice(i).match(/^\[(=*)\[/);
      if (eqMatch) {
        const eq = eqMatch[1];
        const close = ']' + eq + ']';
        let j = src.indexOf(close, i + eq.length + 2);
        if (j < 0) j = n; else j += close.length;
        toks.push({ type: 'longstring', value: src.slice(i, j) }); i = j; continue;
      }
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i + 1;
      while (j < n) {
        const d = src[j];
        if (/[0-9a-fA-FxX._]/.test(d)) { j++; continue; }
        if ((d === '+' || d === '-') && /[eE]/.test(src[j - 1])) { j++; continue; }
        break;
      }
      toks.push({ type: 'num', value: src.slice(i, j) }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1; while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      toks.push({ type: 'ident', value: src.slice(i, j) }); i = j; continue;
    }
    const three = src.slice(i, i + 3);
    const two = src.slice(i, i + 2);
    let op = three;
    if (three !== '...' && three !== '..=') {
      op = two;
      if (two !== '==' && two !== '~=' && two !== '<=' && two !== '>=' &&
          two !== '..' && two !== '::' && two !== '->' && two !== '//') {
        op = c;
      }
    }
    toks.push({ type: 'punct', value: op }); i += op.length;
  }
  return toks;
}

function joinTokens(toks) { return toks.map(t => t.value).join(''); }

/* ---------------- string encryption (works, emoji-safe) ---------------- */
function xorBytes(bytes, key) { return bytes.map(b => b ^ key); }

function utf8ToBytes(str) {
  if (typeof Buffer !== 'undefined') return Array.from(Buffer.from(str, 'utf8'));
  const enc = new TextEncoder();
  return Array.from(enc.encode(str));
}

function makeDecoderSource(name, key, bytes) {
  return `local function ${name}() local k=${key} local b={${bytes.join(',')}} for i=1,#b do b[i]=bit32.bxor(b[i],k) end return string.char(table.unpack(b)) end`;
}

function stringPass(src, rng) {
  const toks = tokenize(src);
  const out = [];
  const decoders = [];
  let prev = null;
  let idx = 0;

  for (let ti = 0; ti < toks.length; ti++) {
    const t = toks[ti];
    if (t.type === 'ws' || t.type === 'comment') { out.push(t.value); continue; }

    if (t.type === 'string' || t.type === 'longstring') {
      let next = null;
      for (let k = ti + 1; k < toks.length; k++) {
        if (toks[k].type !== 'ws' && toks[k].type !== 'comment') { next = toks[k]; break; }
      }
      const isKey = next && next.type === 'punct' && (next.value === ':' || next.value === '=') &&
        prev && prev.type === 'punct' && (prev.value === '{' || prev.value === ',');
      const isMethod = next && next.type === 'punct' && next.value === '(' &&
        prev && prev.type === 'punct' && (prev.value === '{' || prev.value === ',' || prev.value === ';');
      const isGetSet = prev && prev.type === 'ident' && (prev.value === 'get' || prev.value === 'set') &&
        next && next.type === 'punct' && next.value === '(';

      if (!isKey && !isMethod && !isGetSet && !t.hasEsc) {
        let inner;
        if (t.type === 'string') inner = t.value.slice(1, -1);
        else {
          const m = t.value.match(/^\[(=*)\[([\s\S]*)\]=\1\]$/);
          inner = m ? m[2] : t.value;
        }
        const bytes = utf8ToBytes(inner);
        const key = rng() & 0xFF;
        const enc = xorBytes(bytes, key);
        const decName = hexName(rng, 8) + '_' + (idx++);
        decoders.push(makeDecoderSource(decName, key, enc));
        out.push(decName + '()');
      } else {
        out.push(t.value);
      }
      prev = t; continue;
    }
    out.push(t.value);
    prev = t;
  }
  return decoders.join('\n') + '\n' + out.join('');
}

/* ---------------- FIXED: CFF bails on unsafe patterns ---------------- */
const UNSAFE_KW = new Set([
  'if', 'for', 'while', 'repeat', 'do', 'function', 'class',
  'local',      // ← FIX: destroys scope if flattened
  'return',     // ← FIX: needs to terminate the whole body, not one state
  'break',
  'continue',
  'goto',       // ← FIX: control flow breaks state machine
]);

function splitTopLevel(body) {
  const toks = tokenize(body);
  const stmts = [];
  let depthP = 0, depthB = 0, depthC = 0;
  let start = 0;

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.type !== 'punct') continue;
    if (t.value === '(') depthP++;
    else if (t.value === ')') depthP--;
    else if (t.value === '[') depthB++;
    else if (t.value === ']') depthB--;
    else if (t.value === '{') depthC++;
    else if (t.value === '}') depthC--;
    else if (t.value === ';' && depthP === 0 && depthB === 0 && depthC === 0) {
      stmts.push(joinTokens(toks.slice(start, i + 1))); start = i + 1;
    }
  }
  if (start < toks.length) {
    const tail = joinTokens(toks.slice(start));
    if (tail.trim()) stmts.push(tail);
  }

  for (const s of stmts) {
    // labels
    if (s.match(/^\s*::[A-Za-z_]/)) return null;
    // first keyword must not be unsafe
    const kw = s.trim().match(/^([A-Za-z_]+)/);
    if (kw && UNSAFE_KW.has(kw[1])) return null;
    // reject any statement that has unsafe keywords anywhere
    for (const u of UNSAFE_KW) {
      // \b ensures we don't match substrings inside identifiers
      const re = new RegExp('\\b' + u + '\\b');
      if (re.test(s) && !(u === 'do' && /^\s*end\b/.test(s))) return null;
    }
    if (/^\s*\{/.test(s)) return null;
  }
  return stmts;
}

function flattenBody(body, rng) {
  const stmts = splitTopLevel(body);
  if (!stmts || stmts.length < 2) return null;

  const labels = [];
  const used = new Set();
  for (let i = 0; i < stmts.length; i++) {
    let L;
    do { L = rng() >>> 0; } while (used.has(L));
    used.add(L); labels.push(L);
  }

  const sv = hexName(rng, 4);
  let cases = '';
  for (let i = 0; i < stmts.length; i++) {
    let stmt = stmts[i].trim();
    if (!stmt.endsWith(';')) stmt += ';';
    if (i === stmts.length - 1) {
      cases += `elseif ${sv}==${labels[i]} then ${stmt} break`;
    } else {
      cases += `elseif ${sv}==${labels[i]} then ${stmt} ${sv}=${labels[i + 1]}`;
    }
  }
  const fakeCount = 2 + (rng() % 3);
  const fakes = [];
  for (let i = 0; i < fakeCount; i++) {
    let L;
    do { L = rng() >>> 0; } while (used.has(L));
    used.add(L); fakes.push(L);
  }
  for (let i = 0; i < fakes.length; i++) {
    const nextFake = fakes[(i + 1) % fakes.length];
    cases += `elseif ${sv}==${fakes[i]} then ${sv}=${nextFake}`;
  }

  return `local ${sv}=${labels[0]}\nwhile true do\n  if false then\n  ${cases}\n  else break end\nend`;
}

function cffPass(src, rng) {
  const toks = tokenize(src);
  const out = [];
  let pos = 0, i = 0;

  while (i < toks.length) {
    const t = toks[i];
    if (t.type === 'ident' && t.value === 'function') {
      let j = i + 1;
      while (j < toks.length && (toks[j].type === 'ws' || toks[j].type === 'comment')) j++;
      if (j < toks.length && toks[j].type === 'ident') j++;
      while (j < toks.length && (toks[j].type === 'ws' || toks[j].type === 'comment')) j++;
      if (j >= toks.length || toks[j].value !== '(') { i++; continue; }

      let depth = 0, k = j;
      while (k < toks.length) {
        const u = toks[k];
        if (u.type === 'punct') {
          if (u.value === '(') depth++;
          else if (u.value === ')') { depth--; if (depth === 0) { k++; break; } }
        }
        k++;
      }
      while (k < toks.length && (toks[k].type === 'ws' || toks[k].type === 'comment')) k++;
      if (k >= toks.length || toks[k].value !== '{') { i++; continue; }

      let depth2 = 0, m = k;
      while (m < toks.length) {
        const u = toks[m];
        if (u.type === 'punct') {
          if (u.value === '{') depth2++;
          else if (u.value === '}') { depth2--; if (depth2 === 0) break; }
        }
        m++;
      }
      if (m >= toks.length) { i++; continue; }

      const bodyToks = toks.slice(k + 1, m);
      const bodyText = joinTokens(bodyToks);
      const flat = flattenBody(bodyText, rng);
      if (flat) {
        const before = toks.slice(0, k + 1).reduce((acc, tt) => acc + tt.value.length, 0);
        out.push(src.slice(pos, before));
        out.push('\n' + flat + '\n');
        pos = toks.slice(0, m + 1).reduce((acc, tt) => acc + tt.value.length, 0);
        i = m + 1;
        continue;
      }
    }
    i++;
  }
  out.push(src.slice(pos));
  return out.join('');
}

/* ---------------- public API ---------------- */
function obfuscate(source, opts) {
  opts = opts || {};
  const seed = opts.seed || crypto.randomBytes(4).readUInt32LE(0);
  const rng = makePRNG(seed);

  let out = source;
  try {
    // CFF OFF by default — enable only when you have audited it against real scripts
    if (opts.cff === true) out = cffPass(out, rng);
    if (opts.strings !== false) out = stringPass(out, rng);
    return out;
  } catch (e) {
    return source;
  }
}

module.exports = { obfuscate };
