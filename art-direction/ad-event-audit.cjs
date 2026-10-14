// Read-only controller probes: no native bridge, ad request, or production edit.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const cache = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  if (cache.has(filename)) return cache.get(filename);
  const module = {exports: {}};
  cache.set(filename, module.exports);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  vm.runInNewContext(js, {module, exports: module.exports, setTimeout, clearTimeout, require(specifier) {
    if (specifier === '@apps-in-toss/framework') return {};
    if (specifier.startsWith('.')) return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), specifier + '.ts')));
    throw new Error('Unexpected import: ' + specifier);
  }}, {filename});
  return module.exports;
}
const {RewardedRetryAdController} = load('src/app/ads/rewardedRetryAd.ts');
const {StageInterstitialAdController} = load('src/app/ads/stageInterstitialAd.ts');
function probe(Controller, events, ready = true) {
  let loading, showing, phase, continued = 0, cleanups = 0;
  const port = {
    isLoadSupported: () => true, isShowSupported: () => true,
    load(params) { loading = params; return () => cleanups++; },
    show(params) { showing = params; return () => cleanups++; },
  };
  const gate = new Controller(port);
  gate.prepare(state => {phase = state.phase;});
  if (ready) loading.onEvent({type: 'loaded'});
  gate.attempt(() => continued++);
  const originalShow = showing;
  for (const type of events) originalShow.onEvent({type, data: {unitType: '재도전', unitAmount: 1}});
  const result = {events, continued, phase, cleanups};
  gate.dispose();
  return result;
}
console.log(JSON.stringify({
  rewardThenClose: probe(RewardedRetryAdController, ['userEarnedReward', 'dismissed', 'dismissed']),
  earlyClose: probe(RewardedRetryAdController, ['dismissed']),
  closeThenReward: probe(RewardedRetryAdController, ['dismissed', 'userEarnedReward']),
  noLoadCallback: probe(RewardedRetryAdController, [], false),
  noShowCallback: probe(RewardedRetryAdController, []),
  stageLoadUnavailable: probe(StageInterstitialAdController, [], false),
  stageShowFailure: probe(StageInterstitialAdController, ['failedToShow']),
  stageNoShowCallback: probe(StageInterstitialAdController, []),
}, null, 2));
