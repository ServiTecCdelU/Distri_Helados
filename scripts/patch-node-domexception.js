// Patches nested node-domexception packages to use native DOMException (Node.js 18+)
const fs = require('fs');
const path = require('path');

const stub = `'use strict';\nmodule.exports = DOMException;\nmodule.exports.default = DOMException;\n`;

const locations = [
  'node_modules/node-domexception/index.js',
  'node_modules/googleapis/node_modules/node-domexception/index.js',
];

for (const loc of locations) {
  const full = path.join(__dirname, '..', loc);
  if (fs.existsSync(full)) {
    fs.writeFileSync(full, stub);
    console.log(`Patched: ${loc}`);
  }
}
