// lib/obfuscator.js
// Luarix NG v2 — multi-stage rolling encryption + control-flow + stronger anti-tamper
// Emoji-safe (UTF-8 bytes), executor-compatible. Not a full commercial VM.

const crypto = require('crypto');

function rnd(bytes = 6) {
  return crypto.randomBytes(bytes).toString('hex');
}

function rndInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Obfuscate Lua source.
 * @param {string} luaSource
 * @param {object} opts - { maxSize?: number }
 * @returns {string}
 */
function luarixNG(luaSource, opts = {}) {
  if (typeof luaSource !== 'string' || luaSource.length === 0) {
    throw new Error('luaSource must be a non-empty string');
  }
  const maxSize = opts.maxSize || 200_000;
  if (luaSource.length > maxSize) {
    throw new Error(`Source too large (${luaSource.length} > ${maxSize}). Split into modules.`);
  }

  // ── 1. UTF-8 bytes ───────────────────────────────────────────────────
  const srcBytes = Array.from(new TextEncoder().encode(luaSource));
  const L = srcBytes.length;

  // ── 2. Per-build seeds ───────────────────────────────────────────────
  const seedA = crypto.randomBytes(4).readUInt32LE(0) & 0xFFFF;
  const seedB = crypto.randomBytes(4).readUInt32LE(0) & 0xFFFF;
  const seedC = crypto.randomBytes(4).readUInt32LE(0) & 0xFFFF;

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

  // ── 5. Stage 3: final XOR stream from seedC ──────────────────────────
  const s3 = new Uint8Array(L);
  let kC = seedC & 0xFF;
  for (let i = 0; i < L; i++) {
    kC = ((kC * 0x3D) + 0x13 + (i * 7)) & 0xFF;
    s3[i] = (s2[i] ^ kC) & 0xFF;
  }

  // ── 6. Simple FNV-1a style checksum of original bytes ────────────────
  let checksum = 2166136261 >>> 0;
  for (let i = 0; i < L; i++) {
    checksum ^= srcBytes[i];
    checksum = Math.imul(checksum, 16777619) >>> 0;
  }

  // ── 7. Hex encode + chunk ────────────────────────────────────────────
  const hexData = Buffer.from(s3).toString('hex');
  const CHUNK = 480;
  const hexChunks = [];
  for (let i = 0; i < hexData.length; i += CHUNK) {
    hexChunks.push(hexData.slice(i, i + CHUNK));
  }
  const hexExpr = hexChunks.map(c => `"${c}"`).join(' ..\n    ');

  // ── 8. Random identifiers ────────────────────────────────────────────
  const V = {
    P:     '_' + rnd(5),
    hex:   '_' + rnd(5),
    L:     '_' + rnd(4),
    bytes: '_' + rnd(5),
    src:   '_' + rnd(5),
    ls:    '_' + rnd(4),
    fn:    '_' + rnd(4),
    err:   '_' + rnd(4),
    ok:    '_' + rnd(4),
    res:   '_' + rnd(4),
    kA:    '_' + rnd(4),
    kB:    '_' + rnd(4),
    kC:    '_' + rnd(4),
    i:     '_' + rnd(3),
    v0:    '_' + rnd(3),
    v1:    '_' + rnd(3),
    v2:    '_' + rnd(3),
    state: '_' + rnd(5),
    tmp:   '_' + rnd(4),
    chk:   '_' + rnd(4),
    run:   '_' + rnd(4),
  };

  // ── 9. Build Lua ─────────────────────────────────────────────────────
  const lua = `-- Luarix NG v2 build ${rnd(8)}
local ${V.P} = (getgenv and getgenv()) or (getfenv and getfenv(0)) or _G

local ${V.hex} = ${hexExpr}
local ${V.L} = math.floor(#${V.hex} / 2)
local ${V.bytes} = {}

-- ── Anti-tamper layer ────────────────────────────────────────────────
pcall(function()
  local _g = ${V.P}
  -- common spy / hook names (char constructed)
  local n1 = string.char(104,111,111,107,102,117,110,99,116,105,111,110) -- hookfunction
  local n2 = string.char(103,101,116,114,97,119,109,101,116,97,116,97,98,108,101) -- getrawmetatable
  local n3 = string.char(100,101,98,117,103) -- debug
  local n4 = string.char(103,101,116,110,97,109,101,99,97,108,108) -- getnamecall
  if rawget(_g, n1) or rawget(_g, n2) or rawget(_g, n3) or rawget(_g, n4) then
    error("lx.t1")
  end
end)

-- environment sanity
pcall(function()
  if typeof and typeof(game) ~= "Instance" then error("lx.t2") end
  if game and game.GetService then
    local ok, mt = pcall(getmetatable, game)
    if ok and type(mt) == "table" then
      local idx = rawget(mt, "__index")
      if type(idx) == "function" then
        -- soft signal only; do not hard-crash legitimate executors
      end
    end
  end
end)

-- opaque predicate (always false path)
do
  local t = 0
  for x = 1, 23 do t = (t * 5 + x) % 89 end
  if t < 0 or t > 1000 then error("lx.unreachable") end
end

-- local aliases
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

-- ── Control-flow state machine decoder ───────────────────────────────
${V.state} = 1
${V.kC} = ${seedC} % 256
${V.kB} = ${seedB} % 256
${V.kA} = ${seedA} % 256
${V.i} = 1
${V.chk} = 2166136261

while ${V.state} ~= 0 do
  if ${V.state} == 1 then
    -- prepare
    ${V.state} = 2
  elseif ${V.state} == 2 then
    if ${V.i} > ${V.L} then
      ${V.state} = 5
    else
      ${V.state} = 3
    end
  elseif ${V.state} == 3 then
    local hb = _tonum(_sub(${V.hex}, ${V.i} * 2 - 1, ${V.i} * 2), 16)
    ${V.kC} = (${V.kC} * 0x3D + 0x13 + ((${V.i} - 1) * 7)) % 256
    ${V.v2} = _bxor(hb, ${V.kC})
    ${V.kB} = (${V.kB} * 0x1F + 0x07 + (${V.i} - 1)) % 256
    ${V.v1} = (${V.v2} - ${V.kB}) % 256
    ${V.kA} = (${V.kA} * 0x5B + 0x1D + (${V.i} - 1)) % 256
    ${V.v0} = _bxor(${V.v1}, ${V.kA})
    ${V.bytes}[${V.i}] = _char(${V.v0})
    -- running checksum on recovered bytes
    ${V.chk} = _bxor(${V.chk}, ${V.v0})
    ${V.chk} = (${V.chk} * 16777619) % 4294967296
    ${V.i} = ${V.i} + 1
    ${V.state} = 2
  elseif ${V.state} == 5 then
    -- verify checksum
    if ${V.chk} ~= ${checksum} then
      -- silent fail path
      ${V.bytes} = {}
    end
    ${V.state} = 0
  else
    ${V.state} = 0
  end
end

local ${V.src} = _concat(${V.bytes} or {})

-- more junk
do
  local z = 0
  for q = 1, 11 do z = (z + q * q) % 41 end
  if z == -1 then ${V.src} = "" end
end

-- loader with fallbacks
local ${V.ls} = rawget(${V.P}, "loadstring")
  or rawget(${V.P}, "load")
  or rawget(_G, "loadstring")
  or rawget(_G, "load")
  or loadstring
  or load

if not ${V.ls} then
  if typeof and typeof(warn) == "function" then
    warn("[Luarix NG] no loadstring available")
  end
  return
end

-- optional background integrity (non-blocking)
if task and task.spawn then
  task.spawn(function()
    local alive = true
    while alive do
      task.wait(math.random(9, 18))
      pcall(function()
        if typeof and typeof(game) ~= "Instance" then alive = false end
      end)
    end
  end)
end

local ${V.ok}, ${V.res} = pcall(function()
  local ${V.fn}, ${V.err} = ${V.ls}(${V.src})
  if not ${V.fn} then
    return false, ${V.err} or "load failed"
  end
  return true, ${V.fn}()
end)

if not ${V.ok} then
  if typeof and typeof(warn) == "function" then
    -- keep silent in production; uncomment for debug
    -- warn("[Luarix NG]", ${V.res})
  end
end
`;

  return lua.trim();
}

module.exports = { luarixNG };
