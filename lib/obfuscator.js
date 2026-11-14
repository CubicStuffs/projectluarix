// lib/obfuscator.js
// Luarix NG — Two-stage rolling encryption + compat layer + anti-tamper
// Emoji-safe (UTF-8 bytes treated as bytes), executor-compatible.

const crypto = require('crypto');

function rnd(bytes = 6) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Obfuscate Lua source.
 * @param {string} luaSource - raw Lua source
 * @param {object} opts      - optional { maxSize }
 * @returns {string}         - obfuscated Lua string
 */
function luarixNG(luaSource, opts = {}) {
  if (typeof luaSource !== 'string' || luaSource.length === 0) {
    throw new Error('luaSource must be a non-empty string');
  }
  const maxSize = opts.maxSize || 200_000;
  if (luaSource.length > maxSize) {
    throw new Error(
      `Source too large (${luaSource.length} > ${maxSize}). Split into modules.`
    );
  }

  // ── 1. UTF-8 encode (emoji safe: bytes in, bytes out) ────────────────
  const srcBytes = Array.from(new TextEncoder().encode(luaSource));
  const L = srcBytes.length;

  // ── 2. Per-build seeds ───────────────────────────────────────────────
  const seedA = crypto.randomBytes(4).readUInt32LE(0) & 0xFFFF;
  const seedB = crypto.randomBytes(4).readUInt32LE(0) & 0xFFFF;

  // ── 3. Stage 1: rolling XOR ──────────────────────────────────────────
  const s1 = new Uint8Array(L);
  let kA = seedA & 0xFF;
  for (let i = 0; i < L; i++) {
    kA = ((kA * 0x5B) + 0x1D + i) & 0xFF;
    s1[i] = (srcBytes[i] ^ kA) & 0xFF;
  }

  // ── 4. Stage 2: rolling add-mod ──────────────────────────────────────
  const s2 = new Uint8Array(L);
  let kB = seedB & 0xFF;
  for (let i = 0; i < L; i++) {
    kB = ((kB * 0x1F) + 0x07 + i) & 0xFF;
    s2[i] = (s1[i] + kB) & 0xFF;
  }

  // ── 5. Hex encode + chunk (avoid giant single-line strings) ──────────
  const hexData = Buffer.from(s2).toString('hex');
  const CHUNK = 512;
  const hexChunks = [];
  for (let i = 0; i < hexData.length; i += CHUNK) {
    hexChunks.push(hexData.slice(i, i + CHUNK));
  }
  const hexExpr = hexChunks.map(c => `"${c}"`).join(' ..\n    ');

  // ── 6. Random variable names ─────────────────────────────────────────
  const V = {
    P:    '_' + rnd(4),
    hex:  '_' + rnd(4),
    kA:   '_' + rnd(4),
    kB:   '_' + rnd(4),
    i:    '_' + rnd(4),
    v1:   '_' + rnd(4),
    v0:   '_' + rnd(4),
    bytes:'_' + rnd(4),
    src:  '_' + rnd(4),
    ls:   '_' + rnd(4),
    fn:   '_' + rnd(4),
    err:  '_' + rnd(4),
    ok:   '_' + rnd(4),
    res:  '_' + rnd(4),
    L:    '_' + rnd(4),
  };

  // ── 7. Emit Lua ──────────────────────────────────────────────────────
  const lua = `-- Luarix NG build ${rnd(8)}
local ${V.P} = (getgenv and getgenv()) or (getfenv and getfenv(0)) or _G

local ${V.hex} = ${hexExpr}
local ${V.L} = math.floor(#${V.hex} / 2)
local ${V.bytes} = {}

-- Anti-tamper: soft-detect common hooking globals
pcall(function()
    local nm1 = string.char(104,111,111,107,102,117,110,99,116,105,111,110)
    local nm2 = string.char(103,101,116,114,97,119,109,101,116,97,116,97,98,108,101)
    local nm3 = string.char(100,101,98,117,103)
    if rawget(${V.P}, nm1) or rawget(${V.P}, nm2) or rawget(${V.P}, nm3) then
        -- Trigger a benign error that will be swallowed by outer pcall
        error('luarix.tamper')
    end
end)

-- Dead code (opaque predicate — always false at runtime)
do
    local t = 0
    for x = 1, 17 do t = (t * 3 + x) % 97 end
    if t < 0 then error('unreachable') end
end

-- Local aliases (faster in Roblox Luau)
local _sub, _floor = string.sub, math.floor
local _tonum, _char = tonumber, string.char
local _concat = table.concat
local _bxor = (bit32 and bit32.bxor) or function(a, b)
    local r, p = 0, 1
    while a > 0 or b > 0 do
        local aa, bb = a % 2, b % 2
        if aa ~= bb then r = r + p end
        a = _floor(a / 2); b = _floor(b / 2); p = p * 2
    end
    return r
end

-- Decode
${V.kB} = ${seedB} % 256
${V.kA} = ${seedA} % 256
for ${V.i} = 1, ${V.L} do
    local hb = _tonum(_sub(${V.hex}, ${V.i} * 2 - 1, ${V.i} * 2), 16)
    ${V.kB} = (${V.kB} * 0x1F + 0x07 + (${V.i} - 1)) % 256
    ${V.v1} = (hb - ${V.kB}) % 256
    ${V.kA} = (${V.kA} * 0x5B + 0x1D + (${V.i} - 1)) % 256
    ${V.v0} = _bxor(${V.v1}, ${V.kA})
    ${V.bytes}[${V.i}] = _char(${V.v0})
end

local ${V.src} = _concat(${V.bytes})

-- Loader with executor fallbacks
local ${V.ls} = rawget(${V.P}, 'loadstring')
    or rawget(${V.P}, 'load')
    or rawget(_G, 'loadstring')
    or rawget(_G, 'load')
    or loadstring
    or load

if not ${V.ls} then
    if typeof and typeof(warn) == 'function' then
        warn('[Luarix NG] No loadstring / load available in this executor')
    end
    return
end

local ${V.ok}, ${V.res} = pcall(function()
    local ${V.fn}, ${V.err} = ${V.ls}(${V.src})
    if not ${V.fn} then
        return false, ${V.err} or 'loadstring returned nil'
    end
    return true, ${V.fn}()
end)

if not ${V.ok} then
    if typeof and typeof(warn) == 'function' then
        warn('[Luarix NG] runtime error:', ${V.res})
    end
end
`;

  return lua.trim();
}

module.exports = { luarixNG };
