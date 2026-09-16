import leadJabMotion from '../../game/assets/motion/lead-jab.json';
import type { GameClock } from '../../game/engine/GameClock.js';
import type {
  AttackAttemptInputReceipt,
  AttackAttemptSnapshot,
  AttackAttemptTelemetry,
  MultiInputReceipt,
} from './P0AttackAttemptController.js';
import { P0SingleAttackSession } from './P0SingleAttackSession.js';
import {
  DEFAULT_READY_LEAD_IN_MS,
  LEAD_JAB_ATTACK_INSTANCE_PREFIX,
  P0_LEAD_JAB_ATTACK,
} from './leadJabSessionConfig.js';

export { DEFAULT_READY_LEAD_IN_MS } from './leadJabSessionConfig.js';
export type LeadJabSessionTelemetry = AttackAttemptTelemetry;
export type LeadJabSessionSnapshot = AttackAttemptSnapshot;
export type SessionInputReceipt = AttackAttemptInputReceipt;
export type { MultiInputReceipt };

export class P0LeadJabSession extends P0SingleAttackSession {
  constructor(clock: GameClock) {
    super({
      attack: P0_LEAD_JAB_ATTACK,
      attackInstanceIdPrefix: LEAD_JAB_ATTACK_INSTANCE_PREFIX,
      motionSourceId: leadJabMotion.source.id,
      clock,
      defaultLeadInMs: DEFAULT_READY_LEAD_IN_MS,
    });
  }
}
