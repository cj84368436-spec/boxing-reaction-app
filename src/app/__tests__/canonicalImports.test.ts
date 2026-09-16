import {
  createCanonicalGameClock,
  getCanonicalEngineSummary,
} from '../canonicalEngineImports';

describe('canonical engine imports', () => {
  it('loads P0 attacks, sequence, timing, and GameClock through the app bundle boundary', () => {
    const summary = getCanonicalEngineSummary();

    expect(summary.attackIds).toEqual([
      'LEAD_JAB_HEAD',
      'REAR_STRAIGHT_HEAD',
      'LEAD_HOOK_HEAD',
    ]);
    expect(summary.comboCount).toBe(6);
    expect(summary.punchCount).toBe(10);
    expect(summary.preCueBufferMs).toBe(100);
    expect(Number.isFinite(createCanonicalGameClock().nowMs())).toBe(true);
  });
});
