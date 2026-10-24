// Unit test: the lazy export map in src/index.ts covers every Cloud Function defined in lib/
// (a function missing from the map is not deployed, and firebase deploy would offer to delete it).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-projectflow';

const LIB = path.join(__dirname, '../../lib');
// Defined but intentionally not deployed (never exported from index.ts).
const NOT_DEPLOYED = ['blogMetaHandler'];

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.js') ? [full] : [];
});

test('index exports every function defined in lib/ and nothing else', () => {
    const index = require(path.join(LIB, 'index.js'));
    const defined = new Map();
    for (const file of walk(LIB)) {
        if (file === path.join(LIB, 'index.js')) continue;
        const mod = require(file);
        for (const [name, value] of Object.entries(mod)) {
            if (value && value.__endpoint && !NOT_DEPLOYED.includes(name)) defined.set(name, value);
        }
    }
    const exported = Object.keys(index);
    const missing = [...defined.keys()].filter((name) => !exported.includes(name));
    assert.deepEqual(missing, [], `functions missing from FUNCTION_MODULES in src/index.ts: ${missing.join(', ')}`);
    for (const name of exported) {
        assert.equal(index[name], defined.get(name), `${name} in index.ts does not resolve to its module export`);
    }
});
