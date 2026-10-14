const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const {AITReader} = require('@apps-in-toss/ait-format');
const functions = ['BoxerRig', 'CoachReaction', 'SpriteImage'];
const helperNames = new Set(['__create', '__defProp', '__getOwnPropDesc', '__getOwnPropNames',
  '__getProtoOf', '__hasOwnProp', '__copyProps', '__toESM']);
async function audit(file, expectedType) {
  const bytes = fs.readFileSync(file);
  const reader = AITReader.fromBuffer(bytes);
  const report = {file, deploymentId: reader.deploymentId, bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    scope: 'compiled import and JSX type expressions; shared namespace modeled; native rendering excluded', bundles: []};
  for (const entry of reader.listEntries().filter(name => name.endsWith('.js'))) {
    const source = Buffer.from(await reader.readEntry(entry)).toString('utf8');
    const ast = parser.parse(source);
    const helpers = [], bindings = new Map(), jsxTypes = new Map();
    traverse(ast, {
      VariableDeclarator(p) {
        if (helperNames.has(p.node.id.name)) helpers.push(`var ${source.slice(p.node.start, p.node.end)};`);
        if (p.node.id.name?.startsWith('import_react_native_svg')) bindings.set(p.node.id.name, p.node);
      },
      CallExpression(p) {
        const type = p.node.arguments[0];
        if (type?.type !== 'MemberExpression' || !type.object.name?.startsWith('import_react_native_svg')) return;
        const owner = p.findParent(parent => parent.isFunctionDeclaration() && functions.includes(parent.node.id?.name));
        if (owner && !jsxTypes.has(owner.node.id.name)) jsxTypes.set(owner.node.id.name, type);
      },
    });
    const results = [];
    for (const name of functions) {
      const type = jsxTypes.get(name);
      assert(type, `${entry}: SVG JSX not found in ${name}`);
      const binding = bindings.get(type.object.name);
      assert(binding?.init, 'SVG import initializer missing');
      for (const esModule of [true, false]) {
        function Svg() {}
        const sharedNamespace = {default: Svg, Svg};
        if (esModule) Object.defineProperty(sharedNamespace, '__esModule', {value: true});
        const sandbox = {require_react_native_svg: () => sharedNamespace};
        vm.createContext(sandbox);
        vm.runInContext(helpers.join('\n') + `\nvar ${source.slice(binding.start, binding.end)};`, sandbox);
        const component = vm.runInContext(source.slice(type.start, type.end), sandbox);
        assert.equal(typeof component, expectedType, `${entry}: ${name} with __esModule=${esModule}`);
        assert.equal(component === sharedNamespace, expectedType === 'object');
        assert.equal(component === Svg, expectedType === 'function');
        results.push({name, esModule, compiledType: source.slice(type.start, type.end),
          componentType: typeof component, isModuleNamespace: component === sharedNamespace});
      }
    }
    report.bundles.push({entry, results});
    if (expectedType === 'function') {
      const map = JSON.parse(Buffer.from(await reader.readEntry(`${entry}.map`)).toString('utf8'));
      for (const name of functions) {
        const relative = `src/app/components/${name}.tsx`;
        const index = map.sources.findIndex(source => source.replaceAll('\\', '/').endsWith(relative));
        assert(index >= 0);
        assert.equal(map.sourcesContent[index], fs.readFileSync(path.join(path.dirname(file), relative), 'utf8'));
      }
      report.bundles.at(-1).sourceMapsMatchFinalComponents = true;
    }
  }
  assert.equal(report.bundles.length, 4);
  return report;
}
(async () => {
  const project = path.resolve(__dirname, '..');
  const before = await audit(path.join(project, 'release-backup/boxing-talent-test-20261013-before-svg-interop.ait'), 'object');
  const after = process.argv.includes('--before-only') ? null : await audit(path.join(project, 'boxing-talent-test.ait'), 'function');
  const baseline = path.resolve(project, '../../entry-diagnostics/20261013-c');
  const protectedFiles = [];
  function compare(directory) {
    for (const entry of fs.readdirSync(path.join(project, directory), {withFileTypes: true})) {
      const relative = path.join(directory, entry.name);
      if (entry.isDirectory()) compare(relative);
      else {
        assert(fs.readFileSync(path.join(project, relative)).equals(fs.readFileSync(path.join(baseline, relative))), relative);
        protectedFiles.push(relative.replaceAll('\\', '/'));
      }
    }
  }
  for (const directory of ['src/game', 'tests', 'tools/mocap']) compare(directory);
  console.log(JSON.stringify({before, after, protectedFilesIdenticalToDiagnosticBaseline: protectedFiles}, null, 2));
})().catch(error => {console.error(error); process.exitCode = 1;});
