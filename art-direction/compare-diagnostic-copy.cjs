const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const production = path.resolve(__dirname, '..');
const diagnostic = path.resolve(process.argv[2]);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function files(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}
const differences = [];
for (const folder of ['src', 'pages', 'tests', 'tools', 'scripts']) {
  for (const file of files(path.join(production, folder))) {
    const relative = path.relative(production, file).replaceAll('\\', '/');
    assert(fs.existsSync(path.join(diagnostic, relative)), `Missing copy: ${relative}`);
    if (hash(file) !== hash(path.join(diagnostic, relative))) differences.push(relative);
  }
}
assert.deepEqual(differences.sort(), ['src/app/__tests__/releaseConfiguration.test.ts',
  'src/app/screens/DiagnosticEntry.tsx', 'src/pages/index.tsx'].sort());
for (const name of ['package.json', 'package-lock.json', 'granite.config.ts', 'index.ts', 'require.context.ts']) {
  assert.equal(hash(path.join(production, name)), hash(path.join(diagnostic, name)), name);
}
const productionAIT = hash(path.join(production, 'boxing-talent-test.ait'));
assert.equal(productionAIT, '039a4a5f180886572f82df4c028ef7af9541d79b8be8b1a95853c6e7b32f30ab');
console.log(JSON.stringify({productionAIT, differences,
  protectedEngineTestsMotion: 'all original files identical',
  originalConfigurationAndDependencies: 'identical'}, null, 2));
