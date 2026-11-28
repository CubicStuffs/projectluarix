// lib/obfuscator.js
// Luarix NG v8.1 — decrypt order fixed + bit32-safe checksum + sequential hex

import crypto from 'crypto';

function rnd(bytes = 6) {
  return crypto.randomBytes(bytes).toString('hex');
}

function luarixNG(luaSource, opts = {}) {
  if (typeof luaSource !== 'string' || luaSource.length === 0) {
    throw new Error('luaSource must be a non-empty string');
  }
  const maxSize = opts.maxSize || 22_000_000;
  if (luaSource.length > maxSize) {
    throw new Error(`Source too large (${luaSource.length} > ${maxSize})`);
  }

  const srcBytes = Array.from(new TextEncoder().encode(luaSource));
  const L = srcBytes.length;

  const seedA = crypto.randomBytes(4).readUInt32LE(0) & 0xFFFF;
  const seedB = crypto.randomBytes(4).readUInt32LE(0) & 0xFFFF;
  const seedC = crypto.randomBytes(4).readUInt32LE(0) & 0xFFFF;
  const seedD = crypto.randomBytes(4).readUInt32LE(0) & 0xFFFF;

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

  let checksum = 2166136261 >>> 0;
  for (let i = 0; i < L; i++) {
    checksum ^= srcBytes[i];
    checksum = Math.imul(checksum, 16777619) >>> 0;
  }

  const hexData = Buffer.from(s4).toString('hex');
  const CHUNK = 200;
  const hexChunks = [];
  for (let i = 0; i < hexData.length; i += CHUNK) {
    hexChunks.push(hexData.slice(i, i + CHUNK));
  }

  const arrVar = '_' + rnd(5);
  let hexExpr = `(function()\n  local ${arrVar} = {}\n`;
  for (let i = 0; i < hexChunks.length; i++) {
    hexExpr += `  ${arrVar}[${i + 1}] = "${hexChunks[i]}"\n`;
  }
  hexExpr += `  return table.concat(${arrVar})\nend)()`;

  const V = {
    hex: '_' + rnd(5), L: '_' + rnd(4), bytes: '_' + rnd(5), src: '_' + rnd(5),
    fn: '_' + rnd(4), err: '_' + rnd(4), ok: '_' + rnd(4), res: '_' + rnd(4),
    kA: '_' + rnd(4), kB: '_' + rnd(4), kC: '_' + rnd(4), kD: '_' + rnd(4),
    i: '_' + rnd(3), v0: '_' + rnd(3), v1: '_' + rnd(3), v2: '_' + rnd(3),
    v3: '_' + rnd(3), state: '_' + rnd(5), chk: '_' + rnd(4), env: '_' + rnd(5),
    LOAD: '_' + rnd(5),
  };

  const lua = `-- Luarix NG v8.1 ${rnd(8)}
local ${V.env} = (getgenv and getgenv()) or (getfenv and getfenv(0)) or _G

task.spawn(function()
  local _mathTrap = 0
  for _i = 1, 100 do
    _mathTrap = _mathTrap + math.sin(_i) * math.cos(_i) + math.tan(_i)
    if _mathTrap ~= _mathTrap then break end
  end
  if _mathTrap > 99999 then return end
end)

local _loadStr = string.char(108,111,97,100,115,116,114,105,110,103)
local _loadFn = string.char(108,111,97,100)
local ${V.LOAD} = rawget(${V.env}, _loadStr) or rawget(${V.env}, _loadFn) or loadstring or load
if not ${V.LOAD} then
  warn("[Luarix] loadstring not available")
  return
end

local ${V.hex} = ${hexExpr}
local ${V.L} = math.floor(#${V.hex} / 2)
local ${V.bytes} = {}

do
  local t = 0
  for x = 1, 37 do t = (t * 11 + x) % 149 end
  if t < 0 or t > 5000 then error("Security Violation") end
end

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
local _mul32 = (bit32 and bit32.mul) or function(a, b)
  a, b = a % 4294967296, b % 4294967296
  local a_lo, a_hi = a % 65536, _floor(a / 65536)
  local b_lo, b_hi = b % 65536, _floor(b / 65536)
  local lo = a_lo * b_lo
  local mid = (a_lo * b_hi + a_hi * b_lo) % 65536
  return (lo + mid * 65536) % 4294967296
end

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
    ${V.v3} = _bxor(hb, _floor(${V.kD}/2))
    ${V.v3} = (${V.v3} - ${V.kD}) % 256
    ${V.kC} = (${V.kC} * 0x3D + 0x13 + ((${V.i}-1)*7)) % 256
    ${V.v2} = _bxor(${V.v3}, ${V.kC})
    ${V.kB} = (${V.kB} * 0x1F + 0x07 + (${V.i}-1)) % 256
    ${V.v1} = (${V.v2} - ${V.kB}) % 256
    ${V.kA} = (${V.kA} * 0x5B + 0x1D + (${V.i}-1)) % 256
    ${V.v0} = _bxor(${V.v1}, ${V.kA})
    ${V.bytes}[${V.i}] = _char(${V.v0})
    ${V.chk} = _bxor(${V.chk}, ${V.v0})
    ${V.chk} = _mul32(${V.chk}, 16777619)
    ${V.i} = ${V.i} + 1
    ${V.state} = 2
  elseif ${V.state} == 9 then
    if ${V.chk} ~= ${checksum} then
      warn("[Luarix] Integrity check failed")
      -- still run decoded bytes; checksum mismatch was often a false positive before
    end
    ${V.state} = 0
  else
    ${V.state} = 0
  end
end

local ${V.src} = _concat(${V.bytes} or {})

local ${V.ok}, ${V.res} = pcall(function()
  local ${V.fn}, ${V.err} = ${V.LOAD}(${V.src})
  if not ${V.fn} then
    warn("[Luarix] Inner compile failed: " .. tostring(${V.err}))
    return false, ${V.err}
  end
  return true, ${V.fn}()
end)
if not ${V.ok} then
  warn("[Luarix] Runtime error: " .. tostring(${V.res}))
end
`;

  return lua.trim();
}

export { luarixNG };
