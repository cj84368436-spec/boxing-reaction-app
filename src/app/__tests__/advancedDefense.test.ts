import {
  controlsForMode,
  resolveAdvancedDefense,
} from '../session/advancedDefense';

describe('advanced six-button defense', () => {
  it('keeps the beginner controls unchanged and exposes the six PRD techniques in advanced mode', () => {
    expect(controlsForMode('BEGINNER')).toEqual([
      'LEFT',
      'RIGHT',
      'BACK',
      'GUARD',
    ]);
    expect(controlsForMode('ADVANCED')).toEqual([
      'SLIP_LEFT',
      'SLIP_RIGHT',
      'WEAVE_LEFT',
      'WEAVE_RIGHT',
      'SWAY',
      'GUARD',
    ]);
  });

  it('judges the explicit technique instead of collapsing slip and weave into a direction', () => {
    expect(resolveAdvancedDefense('LEAD_JAB_HEAD', 'SLIP_LEFT')).toBe('PERFECT');
    expect(resolveAdvancedDefense('LEAD_JAB_HEAD', 'WEAVE_LEFT')).toBe('HIT');
    expect(resolveAdvancedDefense('REAR_STRAIGHT_HEAD', 'SLIP_LEFT')).toBe('PERFECT');
    expect(resolveAdvancedDefense('REAR_STRAIGHT_HEAD', 'SWAY')).toBe('HIT');
    expect(resolveAdvancedDefense('LEAD_HOOK_HEAD', 'WEAVE_RIGHT')).toBe('PERFECT');
    expect(resolveAdvancedDefense('LEAD_HOOK_HEAD', 'SLIP_RIGHT')).toBe('HIT');
    expect(resolveAdvancedDefense('LEAD_HOOK_HEAD', 'SWAY')).toBe('SAFE');
    expect(resolveAdvancedDefense('LEAD_HOOK_HEAD', 'GUARD')).toBe('SAFE');
  });
});
