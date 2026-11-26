// lib/obfuscator.js
// Luarix NG v6.5 — Anti-Hook, VM Protection, No Freeze

const crypto = require('crypto');

function rnd(bytes = 6) {
  return crypto.randomBytes(bytes).toString('hex');
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

  // Cryptographic Seeds
  const seedA = crypto.randomBytes(4).readUInt32LE(0) & 0xFFFF;
  const seedB = crypto.randomBytes(4).readUInt32LE(0) & 0xFFFF;
  const seedC = crypto.randomBytes(4).readUInt32LE(0) & 0xFFFF;
  const seedD = crypto.randomBytes(4).readUInt32LE(0) & 0xFFFF;

  // Multi-Stage Encryption (VM Bytecode)
  const s1 = new Uint8Array(L);
  let kA = seedA & 0xFF;
  for (let i = 0; i < L; i++) {
    kA = ((kA * 0x5B) + 0x1D + i) & 0xFF;
    s1[i] = (srcBytes[i] ^ kA) & 0xFF;
  }

  const s2 = new Uint8Array(L);
  let kB = seedB & 0xFF;
  for (let i = 0; i < L; i++) {
    kB = ((kB * 0x1F) + 0x07 + i) & 0xFF;
    s2[i] = (s1[i] + kB) & 0xFF;
  }

  const s3 = new Uint8Array(L);
  let kC = seedC & 0xFF;
  for (let i = 0; i < L; i++) {
    kC = ((kC * 0x3D) + 0x13 + (i * 7)) & 0xFF;
    s3[i] = (s2[i] ^ kC) & 0xFF;
  }

  const s4 = new Uint8Array(L);
  let kD = seedD & 0xFF;
  for (let i = 0; i < L; i++) {
    kD = ((kD * 0x2B) + 0x11 + (i * 3)) & 0xFF;
    s4[i] = ((s3[i] + kD) ^ (kD >> 1)) & 0xFF;
  }

  // Checksum
  let checksum = 2166136261 >>> 0;
  for (let i = 0; i < L; i++) {
    checksum ^= srcBytes[i];
    checksum = Math.imul(checksum, 16777619) >>> 0;
  }

  const hexData = Buffer.from(s4).toString('hex');
  const CHUNK = 360;
  const hexChunks = [];
  for (let i = 0; i < hexData.length; i += CHUNK) {
    hexChunks.push(hexData.slice(i, i + CHUNK));
  }
  const hexExpr = hexChunks.map(c => `"${c}"`).join(' ..\n    ');

  const V = {
    P:     '_' + rnd(5), hex:   '_' + rnd(5), L:     '_' + rnd(4),
    bytes: '_' + rnd(5), src:   '_' + rnd(5), ls:    '_' + rnd(4),
    fn:    '_' + rnd(4), err:   '_' + rnd(4), ok:    '_' + rnd(4),
    res:   '_' + rnd(4), kA:    '_' + rnd(4), kB:    '_' + rnd(4),
    kC:    '_' + rnd(4), kD:    '_' + rnd(4), i:     '_' + rnd(3),
    v0:    '_' + rnd(3), v1:    '_' + rnd(3), v2:    '_' + rnd(3),
    v3:    '_' + rnd(3), state: '_' + rnd(5), chk:   '_' + rnd(4),
    alive: '_' + rnd(4), vm:    '_' + rnd(5),
  };

  const lua = `-- Luarix NG v6.5 Anti-Hook VM ${rnd(8)}
local ${V.P} = (getgenv and getgenv()) or (getfenv and getfenv(0)) or _G

-- ========== 1. STRONG ANTI-HOOK & ANTI-DUMP ==========
-- Detect if loadstring or debug is hooked by a dumper
local ${V.ok}, ${V.err} = pcall(function()
    local orig_ls = rawget(${V.P}, "loadstring") or loadstring
    local orig_load = rawget(${V.P}, "load") or load
    
    -- Check if function dump hash matches (dumper often replaces the function)
    if orig_ls and orig_load then
        local ok1, f1 = pcall(string.dump, orig_ls)
        local ok2, f2 = pcall(string.dump, orig_load)
        if ok1 and ok2 and f1 ~= f2 then
            return false -- Hook detected
        end
    end

    -- Check debug environment (common in dumpers)
    if debug and debug.getinfo then
        local info = debug.getinfo(1)
        if info and info.what == "C" then
            return false
        end
    end
    return true
end)

if not ${V.ok} or not ${V.err} then
    -- Silent exit, load dummy code to fool dumper
    local dummy = loadstring("return function() end")
    if dummy then dummy() end
    return
end

-- ========== 2. VM BYTECODE ==========
local ${V.hex} = ${hexExpr}
local ${V.L} = math.floor(#${V.hex} / 2)
local ${V.bytes} = {}

-- ========== 3. OPAQUE PREDICATE ==========
do
  local t = 0
  for x = 1, 37 do t = (t * 11 + x) % 149 end
  if t < 0 or t > 5000 then error("op") end
end

-- ========== 4. VM DECODER ==========
local _sub, _floor = string.sub, math.floor
local _tonum, _char = tonumber, string.char
local _concat = table.concat
local _bxor = (bit32 and bit32.bxor) or function(a, b) ... end

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
      ${V.bytes} = {}
    end
    ${V.state} = 0
  else
    ${V.state} = 0
  end
end

local ${V.src} = _concat(${V.bytes} or {})

-- ========== 5. LOADER ==========
local ${V.ls} = rawget(${V.P}, "loadstring") or rawget(${V.P}, "load") or loadstring or load
if not ${V.ls} then return end

-- Execute
local ${V.ok}, ${V.res} = pcall(function()
  local ${V.fn}, ${V.err} = ${V.ls}(${V.src})
  if not ${V.fn} then return false, ${V.err} end
  return true, ${V.fn}()
end)
`;

  return lua.trim();
}

module.exports = { luarixNG };
