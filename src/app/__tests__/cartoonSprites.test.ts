import { P0_ATTACKS } from '../../game/config/p0Attacks';
import { selectSpriteFrame, spriteCell } from '../motion/cartoonSprites';

describe('cartoon animation stays aligned to the existing combat clock', () => {
  it.each(Object.keys(P0_ATTACKS))('shows the contact drawing at the actual impact for %s', id => {
    const attack = P0_ATTACKS[id as keyof typeof P0_ATTACKS];
    expect(selectSpriteFrame(id, attack.cueAnchorMs - 1)).toBe(0);
    expect(selectSpriteFrame(id, attack.impactMs - 1)).not.toBe(3);
    expect(selectSpriteFrame(id, attack.impactMs)).toBe(3);
    expect(selectSpriteFrame(id, attack.impactMs + 300)).toBe(0);
  });
  it('uses a stable ready pose for invalid or pre-start input', () => {
    expect(selectSpriteFrame('unknown', 200)).toBe(0);
    expect(selectSpriteFrame('LEAD_JAB_HEAD', -100)).toBe(0);
    expect(selectSpriteFrame('LEAD_JAB_HEAD', NaN)).toBe(0);
  });
  it('never samples outside its six-frame sheet', () => {
    for (const id of Object.keys(P0_ATTACKS)) for (let t=0;t<2000;t+=8) {
      const frame=selectSpriteFrame(id,t);
      expect(frame).toBeGreaterThanOrEqual(0);
      expect(frame).toBeLessThan(6);
      const c=spriteCell(frame,1536,2048);
      expect(c.x+c.width).toBeLessThanOrEqual(1536);
      expect(c.y+c.height).toBeLessThanOrEqual(2048);
    }
  });
});
