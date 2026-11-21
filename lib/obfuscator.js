// lib/obfuscator.js
// Luarix NG v3 — Stronger multi-stage + anti-dump focused
// Still loadstring-based (advanced dumpers can still win, but casual ones struggle)

const crypto = require('crypto');

function rnd(bytes = 6) {
  return crypto.randomBytes(bytes).toString('hex');
}

function rndInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function luarixNG(luaSource, opts = {}) {
  if (typeof luaSource !== 'string' || luaSource.length === 0) {
    throw new Error('luaSource must be a non-empty string');
  }
  const maxSize = opts.maxSize || 200_000;
  if (luaSource.length > maxSize) {
    throw new Error(`Source too large (${luaSource.length} > ${maxSize})`);
  }

  const srcBytes = Array.from(new TextEncoder().encode(luaSource));
  const L = srcBytes.length;

  // Multiple independent seeds
  const seedA = crypto.randomBytes(4).readUInt32LE(0) & 0xFFFF;
  const seedB = crypto.randomBytes(4).readUInt32LE(0) & 0xFFFF;
  const seedC = crypto.randomBytes(4).readUInt32LE(0) & 0xFFFF;
  const seedD = crypto.randomBytes(4).readUInt32LE(0) & 0xFFFF;

  // Stage 1 - rolling XOR
  const s1 = new Uint8Array(L);
  let kA = seedA & 0xFF;
  for (let i = 0; i < L; i++) {
    kA = ((kA * 0x5B) + 0x1D + i) & 0xFF;
    s1[i] = (srcBytes[i] ^ kA) & 0xFF;
  }

  // Stage 2 - rolling add
  const s2 = new Uint8Array(L);
  let kB = seedB & 0xFF;
  for (let i = 0; i < L; i++) {
    kB = ((kB * 0x1F) + 0x07 + i) & 0xFF;
    s2[i] = (s1[i] + kB) & 0xFF;
  }

  // Stage 3 - another XOR stream
  const s3 = new Uint8Array(L);
  let kC = seedC & 0xFF;
  for (let i = 0; i < L; i++) {
    kC = ((kC * 0x3D) + 0x13 + (i * 7)) & 0xFF;
    s3[i] = (s2[i] ^ kC) & 0xFF;
  }

  // Stage 4 - final mix
  const s4 = new Uint8Array(L);
  let kD = seedD & 0xFF;
  for (let i = 0; i < L; i++) {
    kD = ((kD * 0x2B) + 0x11 + (i * 3)) & 0xFF;
    s4[i] = ((s3[i] + kD) ^ (kD >> 1)) & 0xFF;
  }

  // Integrity checksum (FNV-ish)
  let checksum = 2166136261 >>> 0;
  for (let i = 0; i < L; i++) {
    checksum ^= srcBytes[i];
    checksum = Math.imul(checksum, 16777619) >>> 0;
  }

  // Hex encode
  const hexData = Buffer.from(s4).toString('hex');
  const CHUNK = 420;
  const hexChunks = [];
  for (let i = 0; i < hexData.length; i += CHUNK) {
    hexChunks.push(hexData.slice(i, i + CHUNK));
  }
  const hexExpr = hexChunks.map(c => `"${c}"`).join(' ..\n    ');

  // Random names
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
    kD:    '_' + rnd(4),
    i:     '_' + rnd(3),
    v0:    '_' + rnd(3),
    v1:    '_' + rnd(3),
    v2:    '_' + rnd(3),
    v3:    '_' + rnd(3),
    state: '_' + rnd(5),
    chk:   '_' + rnd(4),
    alive: '_' + rnd(4),
  };

  const lua = `-- Luarix NG v3 ${rnd(8)}
local ${V.P} = (getgenv and getgenv()) or (getfenv and getfenv(0)) or _G

local ${V.hex} = ${hexExpr}
local ${V.L} = math.floor(#${V.hex} / 2)
local ${V.bytes} = {}

-- ========== ANTI-DUMP / ANTI-HOOK LAYER ==========
pcall(function()
  local g = ${V.P}
  local bad = {
    string.char(104,111,111,107,102,117,110,99,116,105,111,110), -- hookfunction
    string.char(103,101,116,114,97,119,109,101,116,97,116,97,98,108,101), -- getrawmetatable
    string.char(100,101,98,117,103), -- debug
    string.char(103,101,116,103,99), -- getgc
    string.char(103,101,116,114,101,103), -- getreg
    string.char(103,101,116,117,112,118,97,108,117,101,115), -- getupvalues
    string.char(103,101,116,99,111,110,115,116,97,110,116,115), -- getconstants
    string.char(103,101,116,112,114,111,116,111), -- getproto
    string.char(103,101,116,105,110,102,111), -- getinfo
    string.char(105,115,95,108,117,97,95,99,108,111,115,117,114,101), -- is_lua_closure (common in some dumpers)
  }
  for _, name in ipairs(bad) do
    if rawget(g, name) ~= nil then
      -- corrupt environment lightly so dumpers get bad results
      rawset(g, name, function() end)
    end
  end
end)

-- Environment sanity
pcall(function()
  if typeof and typeof(game) ~= "Instance" then error("lx.env") end
end)

-- Opaque predicates
do
  local t = 0
  for x = 1, 29 do t = (t * 7 + x) % 113 end
  if t < 0 or t > 2000 then error("lx.op") end
end

-- Local aliases
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

-- ========== CONTROL FLOW DECODER ==========
${V.state} = 1
${V.kD} = ${seedD} % 256
${V.kC} = ${seedC} % 256
${V.kB} = ${seedB} % 256
${V.kA} = ${seedA} % 256
${V.i} = 1
${V.chk} = 2166136261

while ${V.state} ~= 0 do
  if ${V.state} == 1 then
    ${V.state} = 2
  elseif ${V.state} == 2 then
    if ${V.i} > ${V.L} then
      ${V.state} = 9
    else
      ${V.state} = 3
    end
  elseif ${V.state} == 3 then
    local hb = _tonum(_sub(${V.hex}, ${V.i}*2-1, ${V.i}*2), 16)
    ${V.kD} = (${V.kD} * 0x2B + 0x11 + ((${V.i}-1)*3)) % 256
    ${V.v3} = ((hb - ${V.kD}) % 256)
    ${V.v3} = _bxor(${V.v3}, _floor(${V.kD}/2))
    ${V.kC} = (${V.kC} * 0x3D + 0x13 + ((${V.i}-1)*7)) % 256
    ${V.v2} = _bxor(${V.v3}, ${V.kC})
    ${V.kB} = (${V.kB} * 0x1F + 0x07 + (${V.i}-1)) % 256
    ${V.v1} = (${V.v2} - ${V.kB}) % 256
    ${V.kA} = (${V.kA} * 0x5B + 0x1D + (${V.i}-1)) % 256
    ${V.v0} = _bxor(${V.v1}, ${V.kA})
    ${V.bytes}[${V.i}] = _char(${V.v0})
    ${V.chk} = _bxor(${V.chk}, ${V.v0})
    ${V.chk} = (${V.chk} * 16777619) % 4294967296
    ${V.i} = ${V.i} + 1
    ${V.state} = 2
  elseif ${V.state} == 9 then
    if ${V.chk} ~= ${checksum} then
      ${V.bytes} = {} -- force empty on integrity fail
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
  for q = 1, 13 do z = (z + q*q) % 53 end
  if z == -1 then ${V.src} = "" end
end

-- Loader
local ${V.ls} = rawget(${V.P}, "loadstring")
  or rawget(${V.P}, "load")
  or rawget(_G, "loadstring")
  or rawget(_G, "load")
  or loadstring
  or load

if not ${V.ls} then return end

-- Background integrity (makes some dumpers unhappy)
if task and task.spawn then
  ${V.alive} = true
  task.spawn(function()
    while ${V.alive} do
      task.wait(math.random(7, 16))
      pcall(function()
        if typeof and typeof(game) ~= "Instance" then
          ${V.alive} = false
        end
      end)
    end
  end)
end

local ${V.ok}, ${V.res} = pcall(function()
  local ${V.fn}, ${V.err} = ${V.ls}(${V.src})
  if not ${V.fn} then return false, ${V.err} end
  return true, ${V.fn}()
end)
`;

  return lua.trim();
}

module.exports = { luarixNG };
