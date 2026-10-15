import {PlayRuntime} from '../product/playRuntime';

describe('runtime retry policy', () => {
  it('counts distinct knockouts once and resets only after the owned rewarded completion', () => {
    const runtime = new PlayRuntime();
    const first = runtime.startRound();
    expect(runtime.endRound(first, 'knockout')).toBe(true);
    expect(runtime.endRound(first, 'knockout')).toBe(false);
    expect(runtime.deathsSinceLastAd).toBe(1);
    expect(runtime.requiresReward).toBe(false);
    const clear = runtime.startRound();
    runtime.endRound(clear, 'clear');
    expect(runtime.deathsSinceLastAd).toBe(1);
    runtime.endRound(runtime.startRound(), 'knockout');
    expect(runtime.deathsSinceLastAd).toBe(2);
    expect(runtime.requiresReward).toBe(true);
    const owner = {};
    const ad = runtime.acquireAd(owner, 'rewarded')!;
    expect(runtime.acquireAd({}, 'interstitial')).toBeNull();
    expect(runtime.completeReward(ad)).toBe(true);
    expect(runtime.completeReward(ad)).toBe(false);
    expect(runtime.deathsSinceLastAd).toBe(0);
    runtime.endRound(runtime.startRound(), 'knockout');
    expect(runtime.deathsSinceLastAd).toBe(1);
    expect(first.id).not.toBe(clear.id);
  });
  it('retains count on failure/dispose and rejects stale owners and foreign rounds', () => {
    const runtime = new PlayRuntime();
    runtime.endRound(runtime.startRound(),'knockout');
    runtime.endRound(runtime.startRound(),'knockout');
    const old = runtime.acquireAd({},'rewarded')!;
    runtime.releaseAd(old);
    const current = runtime.acquireAd({},'interstitial')!;
    expect(runtime.completeReward(old)).toBe(false);
    expect(runtime.completeReward(current)).toBe(false);
    expect(runtime.deathsSinceLastAd).toBe(2);
    runtime.releaseAd(current);
    expect(runtime.endRound(new PlayRuntime().startRound(),'knockout')).toBe(false);
    expect(new PlayRuntime().deathsSinceLastAd).toBe(0);
  });
});
