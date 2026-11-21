const { luarixNG } = require('./lib/obfuscator');

const protected = luarixNG(`
print("Hello from protected script")
local a = 42
print(a * 2)
`);

console.log(protected);
