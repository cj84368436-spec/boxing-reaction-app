const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const {AITReader} = require('@apps-in-toss/ait-format');

async function audit(file) {
  const bytes = fs.readFileSync(file);
  const reader = AITReader.fromBuffer(bytes);
  const report = {deploymentId: reader.deploymentId, bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    scope: 'packaged routing and lazy initialization; native host and rendering not executed', bundles: []};
  for (const entry of reader.listEntries().filter(name => name.endsWith('.js'))) {
    const source = Buffer.from(await reader.readEntry(entry)).toString('utf8');
    new vm.Script(source, {filename: entry});
    const ast = parser.parse(source);
    const gameCalls = [];
    let routeMapInitialization;
    traverse(ast, {AssignmentExpression(p) {
      if (p.node.left.type === 'Identifier' && p.node.left.name === 'routeMap' &&
          p.node.right.type === 'NewExpression' && p.node.right.callee.name === 'Map') {
        routeMapInitialization = source.slice(p.node.start, p.node.end);
      }
    }, CallExpression(p) {
      if (p.node.callee.type !== 'Identifier' || p.node.callee.name !== 'init_P0GameScreen') return;
      const enclosing = p.findParent(parent => parent.isFunctionDeclaration() && parent.node.id?.name === 'DiagnosticStartScreen');
      assert(enclosing, `${entry}: game initialization outside diagnostic loader`);
      const loader = p.getFunctionParent();
      assert.equal(loader.node.id?.name, 'loadGame');
      gameCalls.push({line: p.node.loc.start.line, enclosing: 'DiagnosticStartScreen.loadGame'});
    }});
    assert.equal(gameCalls.length, 1);
    const body = ast.program.body.map(node => node.expression?.callee?.body?.body)
      .find(nodes => nodes?.some(node => node.id?.name === 'getRouteScreens'));
    assert(body);
    const functions = new Set(['createRoute', 'getRouteScreens', 'getScreenPathMapConfig',
      'getRoutePath', 'toPosixBasedPath', 'excludeFileExtension', 'excludeRelativePath',
      'excludeDynamicNamePattern', 'matchDynamicName', 'NotFoundPage',
      '_object_without_properties', '_object_without_properties_loose']);
    const variables = new Set(['__defProp', '__export', 'routeMap', 'Route',
      'pages_exports', '__exports', 'requireContext', 'pages_default', 'context']);
    assert(routeMapInitialization, 'compiled route map initialization missing');
    const chunks = [`var routeMap; ${routeMapInitialization};`];
    for (const node of body) {
      if (node.type === 'FunctionDeclaration' && functions.has(node.id.name)) chunks.push(source.slice(node.start, node.end));
      if (node.type === 'VariableDeclaration') for (const declaration of node.declarations) {
        if (variables.has(declaration.id.name)) chunks.push(`var ${source.slice(declaration.start, declaration.end)};`);
      }
      const call = node.expression;
      if (call?.callee?.name === '__export' && ['pages_exports', '__exports'].includes(call.arguments[0]?.name)) chunks.push(source.slice(node.start, node.end));
      if (call?.type === 'AssignmentExpression' && call.left?.object?.name === 'requireContext' && call.left?.property?.name === 'keys') chunks.push(source.slice(node.start, node.end));
    }
    const sandbox = {DiagnosticStartScreen: function DiagnosticStartScreen() {}, useNavigation() {}};
    vm.createContext(sandbox);
    vm.runInContext(chunks.join('\n'), sandbox);
    const screens = sandbox.getRouteScreens(sandbox.context);
    const config = sandbox.getScreenPathMapConfig(screens);
    assert.equal(screens.find(screen => screen.path === '/')?.component, sandbox.DiagnosticStartScreen);
    assert.equal(screens.find(screen => screen.path === '/_404')?.component, sandbox.NotFoundPage);
    assert.equal(config['/'].path, '');
    assert.equal(config['/_404'].path, '*');
    assert.throws(() => sandbox.getScreenPathMapConfig(screens.filter(screen => screen.path !== '/_404')), /404 page not found/);
    const map = JSON.parse(Buffer.from(await reader.readEntry(`${entry}.map`)).toString('utf8'));
    for (const relative of ['src/pages/index.tsx', 'src/app/screens/DiagnosticEntry.tsx', 'pages/_404.tsx']) {
      const index = map.sources.findIndex(name => name.replaceAll('\\', '/').endsWith(relative));
      assert(index >= 0, `${entry}: missing ${relative}`);
      assert.equal(map.sourcesContent[index], fs.readFileSync(path.join(path.dirname(file), relative), 'utf8'));
    }
    report.bundles.push({entry, keys: Array.from(sandbox.context.keys()), root: 'DiagnosticStartScreen',
      missing404NegativeControl: 'exact exception reproduced', gameInitialization: gameCalls,
      sourceMapMatchesDiagnosticCopy: true});
  }
  assert.equal(report.bundles.length, 4);
  console.log(JSON.stringify(report, null, 2));
}
audit(path.resolve(process.argv[2])).catch(error => {console.error(error); process.exitCode = 1;});
