'use strict';
/**
 * Project Luarix — lib/obfuscator.js (v2.5.1)
 *
 * Fixes vs v2.5:
 *   - Removed stray module-scope `const seed = ...` (would crash on load)
 *   - `obfuscate()` now uses browser-safe `randomSeed()` instead of Node `crypto`
 *   - Everything else unchanged
 *
 * NOTE: This obfuscator targets JAVASCRIPT, not Luau. See warning at bottom.
 */

/* ---------------- browser-safe seed ---------------- */
function randomSeed() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] >>> 0;
  }
  return (Math.random() * 0xFFFFFFFF) >>> 0;
}

/* ---------------- PRNG ---------------- */
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
  const a = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_0123456789';
  let n = '_';
  for (let i = 0; i < (len || 6); i++) n += a[rng() % a.length];
  return n;
}

/* ---------------- string cipher ---------------- */
function ror5(b) { return ((b >>> 5) | (b << 3)) & 0xFF; }

function utf8Bytes(str) {
  if (typeof Buffer !== 'undefined') return Array.from(Buffer.from(str, 'utf8'));
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
    else if (c >= 0xD800 && c <= 0xDBFF) {
      const c2 = str.charCodeAt(++i);
      const cp = 0x10000 + ((c & 0x3FF) << 10) + (c2 & 0x3FF);
      out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    } else out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

function encodeBytes(buf, mul, inc) {
  const out = new Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const k = i >> 2;
    const key = (k * mul) & 0xFF;
    const y = (buf[i] ^ key) & 0xFF;
    const x = ror5(y);
    out[i] = (x + ((k * inc) & 0xFF)) & 0xFF;
  }
  return out;
}

function decoderSource(name, mul, inc) {
  return 'function ' + name + '(c){var n=c.length,i=0,b=[];for(;i<n;i++){var k=i>>2;' +
    'var key=(k*' + mul + ')&255;var x=(c[i]-((k*' + inc + ')&255)+512)&255;' +
    'var y=((x<<5)|(x>>>3))&255;b.push(y^key);}' +
    'var s="",j=0;while(j<b.length){var q=b[j++];' +
    'if(q<128){s+=String.fromCharCode(q);}' +
    'else if(q<224){s+=String.fromCharCode(((q&31)<<6)|(b[j++]&63));}' +
    'else if(q<240){var q2=b[j++],q3=b[j++];s+=String.fromCharCode(((q&15)<<12)|((q2&63)<<6)|(q3&63));}' +
    'else{var q2=b[j++],q3=b[j++],q4=b[j++];var cp=((q&7)<<18)|((q2&63)<<12)|((q3&63)<<6)|(q4&63);' +
    'cp-=0x10000;s+=String.fromCharCode(0xD800+(cp>>10),0xDC00+(cp&1023));}}return s;}';
}

/* ---------------- tokenizer ---------------- */
function tokenize(src) {
  const toks = [], n = src.length;
  const REGEX_PREV_CHAR = /[\(\,\=\:\?\[\!\&\|\{\}\;\+\-\*\%\~\^\<\>]/;
  const REGEX_PREV_KW = new Set(['return','typeof','instanceof','in','of','new','delete','void','throw','case','do','else','yield','await']);
  let i = 0, last = null;
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { let j = i + 1; while (j < n && /\s/.test(src[j])) j++; toks.push({type:'ws',value:src.slice(i,j)}); i = j; continue; }
    if (c === '/' && src[i+1] === '/') { let j = src.indexOf('\n', i); if (j < 0) j = n; toks.push({type:'comment',value:src.slice(i,j)}); i = j; continue; }
    if (c === '/' && src[i+1] === '*') { let j = src.indexOf('*/', i+2); j = j < 0 ? n : j + 2; toks.push({type:'comment',value:src.slice(i,j)}); i = j; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1, hasEsc = false;
      while (j < n) { const d = src[j]; if (d === '\\') { hasEsc = true; j += 2; continue; } if (d === c) { j++; break; } if (d === '\n') break; j++; }
      toks.push({type:'string',value:src.slice(i,j),hasEsc,quote:c}); last = {t:'str'}; i = j; continue;
    }
    if (c === '`') {
      let j = i + 1, hasSubst = false;
      while (j < n) {
        const d = src[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '$' && src[j+1] === '{') { hasSubst = true; j += 2; let dep = 1; while (j < n && dep > 0) { if (src[j] === '{') dep++; else if (src[j] === '}') dep--; j++; } continue; }
        if (d === '`') { j++; break; }
        j++;
      }
      toks.push({type:'template',value:src.slice(i,j),hasSubst}); last = {t:'str'}; i = j; continue;
    }
    if (c === '/') {
      let isRegex = false;
      if (!last) isRegex = true;
      else if (last.t === 'punct' && REGEX_PREV_CHAR.test(last.v)) isRegex = true;
      else if (last.t === 'ident' && REGEX_PREV_KW.has(last.v)) isRegex = true;
      if (isRegex) {
        let j = i + 1, inClass = false;
        while (j < n) { const d = src[j]; if (d === '\\') { j += 2; continue; } if (d === '[') inClass = true; else if (d === ']') inClass = false; else if (d === '/' && !inClass) { j++; break; } else if (d === '\n') break; j++; }
        while (j < n && /[a-z]/i.test(src[j])) j++;
        toks.push({type:'regex',value:src.slice(i,j)}); last = {t:'regex'}; i = j; continue;
      }
      toks.push({type:'punct',value:'/'}); last = {t:'punct',v:'/'}; i++; continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i+1] || ''))) {
      let j = i + 1;
      while (j < n) {
        const d = src[j];
        if (/[0-9a-fA-FxXoObB._]/.test(d)) { j++; continue; }
        if ((d === '+' || d === '-') && /[eE]/.test(src[j-1])) { j++; continue; }
        break;
      }
      toks.push({type:'num',value:src.slice(i,j)}); last = {t:'num'}; i = j; continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1; while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const v = src.slice(i, j);
      toks.push({type:'ident',value:v}); last = {t:'ident',v}; i = j; continue;
    }
    toks.push({type:'punct',value:c}); last = {t:'punct',v:c}; i++; continue;
  }
  return toks;
}

/* ---------------- string pass ---------------- */
function stringPass(src, rng, decName, mul, inc) {
  const toks = tokenize(src);
  let out = '', prev = null;
  for (let idx = 0; idx < toks.length; idx++) {
    const t = toks[idx];
    if (t.type === 'ws' || t.type === 'comment') { out += t.value; continue; }
    if (t.type === 'string') {
      const raw = t.value, inner = raw.slice(1, -1);
      let next = null;
      for (let k = idx + 1; k < toks.length; k++) { if (toks[k].type === 'ws' || toks[k].type === 'comment') continue; next = toks[k]; break; }
      const isDirective = inner === 'use strict' || inner === 'use asm';
      const isModule = prev && prev.type === 'ident' && (prev.value === 'from' || prev.value === 'import');
      const isKey = next && next.type === 'punct' && next.value === ':' && prev && prev.type === 'punct' && (prev.value === '{' || prev.value === ',');
      const isMethodName = next && next.type === 'punct' && next.value === '(' &&
        prev && prev.type === 'punct' && (prev.value === '{' || prev.value === ',' || prev.value === ';');
      const isGetSetKey = prev && prev.type === 'ident' && (prev.value === 'get' || prev.value === 'set') &&
        next && next.type === 'punct' && next.value === '(';
      if (!t.hasEsc && !isDirective && !isModule && !isKey && !isMethodName && !isGetSetKey) {
        out += decName + '(' + JSON.stringify(encodeBytes(utf8Bytes(inner), mul, inc)) + ')';
      } else out += raw;
      prev = t; continue;
    }
    out += t.value;
    prev = t;
  }
  return out;
}

/* ---------------- CFF ---------------- */
const UNSAFE_KW = new Set(['if','for','while','switch','try','do','with','break','continue','function','class','async','import','export']);

function endsSafely(stmt) {
  const s = stmt.replace(/\s+$/, '');
  if (s.endsWith(';')) return true;
  if (s.endsWith('}')) {
    if (/\basync\b/.test(s)) return false;
    if (/(?:=>|\=\s*\{)/.test(s)) return false;
    return true;
  }
  return false;
}

function splitTopLevel(body) {
  const toks = tokenize(body), stmts = [];
  let dP = 0, dB = 0, dC = 0, start = 0;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.type !== 'punct') continue;
    if (t.value === '(') dP++;
    else if (t.value === ')') dP--;
    else if (t.value === '[') dB++;
    else if (t.value === ']') dB--;
    else if (t.value === '{') dC++;
    else if (t.value === '}') dC--;
    else if (t.value === ';' && dP === 0 && dB === 0 && dC === 0) {
      stmts.push(joinToks(toks, start, i + 1)); start = i + 1;
    }
  }
  if (start < toks.length) {
    const tail = joinToks(toks, start, toks.length);
    if (tail.trim()) stmts.push(tail);
  }
  for (const s of stmts) {
    if (s.match(/^\s*[A-Za-z_$][\w$]*\s*:/)) return null;
    const kw = s.match(/^\s*([A-Za-z_$][\w$]*)/);
    if (kw && UNSAFE_KW.has(kw[1])) return null;
    if (/^\s*\{/.test(s)) return null;
    if (!endsSafely(s)) return null;
  }
  return stmts;
}
function joinToks(toks, a, b) {
  let s = '';
  for (let i = a; i < b; i++) s += toks[i].value;
  return s;
}

function flattenBody(body, rng) {
  let stmts = splitTopLevel(body);
  if (!stmts) return null;
  stmts = stmts.filter(s => s.trim().length > 0);
  if (stmts.length < 2) return null;

  const used = new Set(), labels = [];
  for (let i = 0; i < stmts.length; i++) {
    let L;
    do { L = (rng() >>> 0) % 0xFFFFFFF; } while (used.has(L));
    used.add(L); labels.push(L);
  }

  const sv = hexName(rng, 4);
  const order = stmts.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = rng() % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }

  let cases = '';
  for (const idx of order) {
    let stmt = stmts[idx].trim();
    if (!/[;}]$/.test(stmt)) stmt += ';';
    if (idx === stmts.length - 1) cases += 'case ' + labels[idx] + ': ' + stmt + ' break _L;\n';
    else cases += 'case ' + labels[idx] + ': ' + stmt + ' ' + sv + '=' + labels[idx+1] + '; break;\n';
  }

  const fakeCount = 2 + (rng() % 3);
  const fakes = [];
  for (let i = 0; i < fakeCount; i++) {
    let L;
    do { L = (rng() >>> 0) % 0xFFFFFFF; } while (used.has(L));
    used.add(L); fakes.push(L);
  }
  for (let i = 0; i < fakes.length; i++) {
    const nextFake = fakes[(i + 1) % fakes.length];
    cases += 'case ' + fakes[i] + ': ' + sv + '=' + nextFake + '; break;\n';
  }

  return 'var ' + sv + '=' + labels[0] + ';\n_L: while(true){switch(' + sv + '){\n' + cases + 'default: break _L;\n}}';
}

function cffPass(src, rng) {
  const toks = tokenize(src);
  let out = '', pos = 0, i = 0;
  while (i < toks.length) {
    const t = toks[i];
    if (t.type === 'ident' && t.value === 'function') {
      let j = i + 1;
      while (j < toks.length && (toks[j].type === 'ws' || toks[j].type === 'comment')) j++;
      if (j < toks.length && toks[j].type === 'ident') j++;
      while (j < toks.length && (toks[j].type === 'ws' || toks[j].type === 'comment')) j++;
      if (j < toks.length && toks[j].type === 'punct' && toks[j].value === '(') {
        let dep = 0, k = j;
        for (; k < toks.length; k++) { const u = toks[k]; if (u.type !== 'punct') continue; if (u.value === '(') dep++; else if (u.value === ')') { dep--; if (dep === 0) { k++; break; } } }
        while (k < toks.length && (toks[k].type === 'ws' || toks[k].type === 'comment')) k++;
        if (k < toks.length && toks[k].type === 'punct' && toks[k].value === '{') {
          let dep2 = 0, m = k;
          for (; m < toks.length; m++) { const u = toks[m]; if (u.type !== 'punct') continue; if (u.value === '{') dep2++; else if (u.value === '}') { dep2--; if (dep2 === 0) break; } }
          if (m < toks.length) {
            let oStart = 0; for (let z = 0; z <= k; z++) oStart += toks[z].value.length;
            let oEnd = oStart; for (let z = k + 1; z < m; z++) oEnd += toks[z].value.length;
            const bodyText = src.slice(oStart, oEnd);
            const flat = flattenBody(bodyText, rng);
            if (flat) {
              out += src.slice(pos, oStart) + '\n' + flat + '\n';
              pos = oEnd;
              i = m + 1;
              continue;
            }
          }
        }
      }
    }
    i++;
  }
  out += src.slice(pos);
  return out;
}

/* ---------------- prelude ---------------- */
function runtimePrelude(rng, decName, opts, mul, inc) {
  const sentinel = hexName(rng, 6);
  const sentVal = rng() >>> 0;
  const period = 1500 + (rng() % 3000);
  const target = (opts && opts.target) || 'browser';
  let s = '/* luarix runtime */\n' + decoderSource(decName, mul, inc) + '\n';
  if (target === 'browser' && opts && opts.heartbeat) {
    s += '(function(){var g=(typeof globalThis!=="undefined")?globalThis:(typeof window!=="undefined"?window:this);\n';
    s += 'g[' + JSON.stringify(sentinel) + ']=' + sentVal + ';\n';
    s += 'if(typeof setInterval==="function"){setInterval(function(){try{if(g[' + JSON.stringify(sentinel) + ']!==' + sentVal + '){' +
         (opts.hostile ? 'while(1){}' : 'throw new Error("t");') +
         '}}catch(e){}}, ' + period + ');}\n';
    s += '})();\n';
  }
  return s;
}

/* ---------------- verification ---------------- */
function verifyOutput(code) {
  try {
    new Function('"use strict"; ' + code);
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------------- directive hoist ---------------- */
function hoistDirectives(src) {
  const m = src.match(/^(\s*(?:(?:\/\*[\s\S]*?\*\/)|(?:\/\/[^\n]*\n)|\s)*(?:"use strict"|'use strict'|"use asm"|'use asm')\s*;?)/);
  if (m) return { directive: m[1], rest: src.slice(m[0].length) };
  return { directive: '', rest: src };
}

/* ---------------- public API ---------------- */
function obfuscate(source, opts) {
  opts = opts || {};
  const seed = opts.seed || randomSeed();
  const rng = makePRNG(seed);
  const decName = hexName(rng, 8);
  const mul = (rng() | 1) >>> 0;
  const inc = (rng() & 0xFF) | 1;

  let out = source;
  try {
    if (opts.cff !== false)     out = cffPass(out, rng);
    if (opts.strings !== false) out = stringPass(out, rng, decName, mul, inc);

    const d = hoistDirectives(out);
    const prelude = runtimePrelude(rng, decName, opts, mul, inc);
    const result = d.directive + '\n' + prelude + '\n' + d.rest;

    if (!verifyOutput(result)) {
      return source;
    }
    return result;
  } catch (e) {
    return source;
  }
}

/* ---------------- exports (works in Node + browser) ---------------- */
const _exports = {
  obfuscate,
  randomSeed,
  _internal: { tokenize, splitTopLevel, encodeBytes, decoderSource, verifyOutput }
};
if (typeof module !== 'undefined' && module.exports) {
  module.exports = _exports;
}
if (typeof window !== 'undefined') {
  window.Luarix = _exports;
}

/* ---------------- CLI (Node only) ---------------- */
if (typeof require !== 'undefined' && require.main === module) {
  const fs = require('fs');
  const args = process.argv.slice(2);
  const inFile = args[0];
  const outIdx = args.indexOf('-o');
  const outFile = outIdx >= 0 ? args[outIdx + 1] : inFile.replace(/\.js$/, '.obf.js');
  if (!inFile) { console.error('usage: node obfuscator.js <in.js> [-o out.js] [--hostile] [--heartbeat]'); process.exit(1); }
  const src = fs.readFileSync(inFile, 'utf8');
  const res = obfuscate(src, { hostile: args.includes('--hostile'), heartbeat: args.includes('--heartbeat'), target: 'node' });
  fs.writeFileSync(outFile, res);
  console.log('wrote ' + outFile + ' (' + res.length + ' bytes)');
}
