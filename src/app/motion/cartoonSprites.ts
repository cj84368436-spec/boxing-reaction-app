import { P0_ATTACKS } from '../../game/config/p0Attacks.js';
import { CHAMPION_UPPERCUT } from '../session/championRules.js';

/** Authored drawings follow the game clock; they never drive the judgment clock. */
export function selectSpriteFrame(attackId: string, elapsedMs: number): number {
  const attack = attackId===CHAMPION_UPPERCUT.attackId?CHAMPION_UPPERCUT:P0_ATTACKS[attackId as keyof typeof P0_ATTACKS];
  if (!attack || !Number.isFinite(elapsedMs) || elapsedMs < attack.cueAnchorMs) return 0;
  if (elapsedMs < attack.impactMs) {
    const progress = (elapsedMs - attack.cueAnchorMs) / (attack.impactMs - attack.cueAnchorMs);
    return progress < .55 ? 1 : 2;
  }
  const recovery = elapsedMs - attack.impactMs;
  return recovery < 55 ? 3 : recovery < 150 ? 4 : recovery < 240 ? 5 : 0;
}

export function selectSpriteSheet(attackId: string, frame: number): 'jab' | 'straight' | 'hook' | 'uppercut' {
  if (frame === 0 || frame === 5) return 'jab';
  if (attackId === CHAMPION_UPPERCUT.attackId) return 'uppercut';
  if (attackId === 'LEAD_HOOK_HEAD') return 'hook';
  if (attackId === 'REAR_STRAIGHT_HEAD') return 'straight';
  return 'jab';
}

export function spriteCell(frame: number, sheetWidth: number, sheetHeight: number) {
  const index = Number.isFinite(frame) ? Math.max(0, Math.min(5, Math.floor(frame))) : 0;
  const width = sheetWidth / 3;
  const height = sheetHeight / 2;
  return { x: (index % 3) * width, y: Math.floor(index / 3) * height, width, height };
}
