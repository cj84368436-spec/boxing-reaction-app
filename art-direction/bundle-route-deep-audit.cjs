// Read-only probe of the route code inside the packaged AIT, not of a reconstructed file list.
// Native host, React rendering, advertising and device execution are outside this probe.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const parser = require('@babel/parser');
const {AITReader} = require('@apps-in-toss/ait-format');
const project = path.resolve(__dirname, '..');
const getStateFromPath = require(path.join(project, 'node_modules/@react-navigation/core/lib/commonjs/getStateFromPath.js')).default;
const extractPathFromURL = require(path.join(project, 'node_modules/@react-navigation/native/lib/commonjs/extractPathFromURL.js')).default;

async function audit() {
  const reader = AITReader.fromBuffer(fs.readFileSync(path.join(project, 'boxing-talent-test.ait')));
  const report = {deploymentId: reader.deploymentId, scope: 'packaged route code and local React Navigation URL parser; native host and rendering excluded', bundles: []};
  for (const entry of reader.listEntries().filter(name => name.endsWith('.js'))) {
    const source = Buffer.from(await reader.readEntry(entry)).toString('utf8');
    new vm.Script(source, {filename: entry});
    const ast = parser.parse(source);
    const body = ast.program.body.map(node => node.expression?.callee?.body?.body)
      .find(nodes => nodes?.some(node => node.id?.name === 'getRouteScreens'));
    assert(body, `Route implementation missing from ${entry}`);
    const functions = new Set([
      'createRoute', 'getRouteScreens', 'getScreenPathMapConfig', 'getRoutePath',
      'toPosixBasedPath', 'excludeFileExtension', 'excludeRelativePath', 'excludeDynamicNamePattern',
      'matchDynamicName', 'getSchemePrefix', 'defaultGetInitialUrl', 'NotFoundPage',
      '_object_without_properties', '_object_without_properties_loose',
    ]);
    const variables = new Set(['__defProp', '__export', 'routeMap', 'Route', 'pages_exports', '__exports', 'requireContext', 'pages_default', 'context']);
    const chunks = [];
    for (const node of body) {
      if (node.type === 'FunctionDeclaration' && functions.has(node.id.name)) chunks.push(source.slice(node.start, node.end));
      if (node.type === 'VariableDeclaration') {
        for (const declaration of node.declarations) {
          if (variables.has(declaration.id.name)) chunks.push(`var ${source.slice(declaration.start, declaration.end)};`);
        }
      }
      const call = node.expression;
      if (call?.callee?.name === '__export' && ['pages_exports', '__exports'].includes(call.arguments[0]?.name)) chunks.push(source.slice(node.start, node.end));
      if (call?.type === 'AssignmentExpression' && call.left?.object?.name === 'requireContext' && call.left?.property?.name === 'keys') chunks.push(source.slice(node.start, node.end));
    }
    // The game body and navigation hooks are not executed; preserve their identities for registration checks.
    const sandbox = {P0GameScreen: function P0GameScreen() {}, useNavigation: function navigationNotExecuted() {}};
    vm.createContext(sandbox);
    vm.runInContext(chunks.join('\n'), sandbox);
    const {context, getRouteScreens, getScreenPathMapConfig} = sandbox;
    const screens = getRouteScreens(context);
    const config = getScreenPathMapConfig(screens);
    assert.equal(screens.find(screen => screen.path === '/')?.component, sandbox.P0GameScreen);
    assert.equal(screens.find(screen => screen.path === '/_404')?.component, sandbox.NotFoundPage);
    assert.equal(config['/'].path, '');
    assert.equal(config['/_404'].path, '*');
    assert.throws(() => getScreenPathMapConfig(screens.filter(screen => screen.path !== '/_404')), /404 page not found/);
    const withoutRoot = screens.filter(screen => screen.path !== '/');
    assert.equal(getScreenPathMapConfig(withoutRoot)['/'].path, '');
    assert.equal(withoutRoot.some(screen => screen.path === '/'), false);
    const prefix = sandbox.getSchemePrefix({scheme: 'intoss', appName: reader.appName, host: ''});
    const URLs = [
      prefix,
      `${prefix}/`,
      `${prefix}?_deploymentId=${reader.deploymentId}`,
      `${prefix}/index`,
      `${prefix}/not-a-page`,
      `intoss-private://${reader.appName}?_deploymentId=${reader.deploymentId}`,
    ].map(url => {
      const initial = sandbox.defaultGetInitialUrl(url);
      const routePath = extractPathFromURL([prefix], initial);
      const state = routePath == null ? undefined : getStateFromPath(routePath, {screens: config});
      return {url, extractedPath: routePath ?? null, screen: state?.routes?.[0]?.name ?? null};
    });
    assert.equal(URLs[0].screen, '/');
    assert.equal(URLs[1].screen, '/');
    assert.equal(URLs[2].screen, '/');
    assert.equal(URLs[3].screen, '/_404');
    assert.equal(URLs[4].screen, '/_404');
    const registrationNode = body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'registerApp');
    assert(registrationNode, 'SDK registerApp function missing');
    const registry = new Map();
    const host = {
      import_react_native126: {AppRegistry: {getAppKeys: () => Array.from(registry.keys())}},
      getAppName2: () => reader.appName,
      Analytics: {init() {}},
      getSchemeUri2: () => prefix,
      setIosSwipeGestureEnabled() {},
      AppsInTossContainer() {},
      AppsInTossScreenContainer() {},
      // Model only registry persistence. Native registration and React rendering are excluded.
      Granite: {registerApp(_container, options) {
        const root = () => getScreenPathMapConfig(getRouteScreens(options.context));
        registry.set(options.appName, root);
        return root;
      }},
    };
    host.global = host;
    vm.createContext(host);
    vm.runInContext(source.slice(registrationNode.start, registrationNode.end), host);
    const oldContext = Object.assign(key => context(key), {keys: () => Array.from(context.keys()).filter(key => key !== './_404.tsx')});
    const oldRoot = host.registerApp(function Container() {}, {context: oldContext});
    assert.throws(oldRoot, /404 page not found/);
    const secondRoot = host.registerApp(function Container() {}, {context});
    assert.equal(secondRoot, oldRoot);
    assert.throws(secondRoot, /404 page not found/);
    registry.clear();
    delete host.Page;
    const freshRoot = host.registerApp(function Container() {}, {context});
    assert.notEqual(freshRoot, oldRoot);
    assert.equal(freshRoot()['/_404'].path, '*');
    report.bundles.push({entry, syntax: 'valid in Node VM', keys: Array.from(context.keys()), rootComponent: 'P0GameScreen', rootPath: sandbox.Route._path, negative404Control: 'reproduced exact exception', rootMapAloneDoesNotProveRegisteredScreen: true, SDKRegistrationReplay: {sameRegistry: 'previous root retained despite new context; old 404 exception persists', clearedRegistry: 'new context registered; no missing-404 exception', actualDeviceRegistryPersistence: 'unknown'}, URLs});
  }
  assert.equal(report.bundles.length, 4);
  console.log(JSON.stringify(report, null, 2));
}
audit().catch(error => {console.error(error); process.exitCode = 1;});
