import { P0_SEQUENCE } from '../../game/config/p0Sequence.js';
import type { GameClock } from '../../game/engine/GameClock.js';
import type { AttackDefinition, DefenseInput, DefenseOutcome } from '../../game/model/types.js';
import {
  P0AttackAttemptController,
  type AttackAttemptInputReceipt,
  type AttackAttemptSnapshot,
  type AttackAttemptStartOptions,
  type AttackAttemptTelemetry,
} from './P0AttackAttemptController.js';

const SINGLE_ATTACK_COMBO_COUNT = 3;

interface AttackPlan {
  readonly comboId: string;
  readonly comboIndex: number;
  readonly attackIndex: number;
  readonly attack: AttackDefinition;
  readonly offsetFromSessionStartMs: number;
}

interface RunningAttack extends AttackPlan {
  readonly attackInstanceId: string;
  readonly controller: P0AttackAttemptController;
}

export interface ScheduledSessionAttack {
  readonly comboId: string;
  readonly comboIndex: number;
  readonly attackIndex: number;
  readonly attackId: string;
  readonly attackInstanceId: string;
  readonly attackStartScheduledAtMs: number | undefined;
}

export interface SessionAttackResult {
  readonly comboId: string;
  readonly comboIndex: number;
  readonly attackIndex: number;
  readonly attackId: string;
  readonly attackInstanceId: string;
  readonly outcome: DefenseOutcome;
  readonly telemetry: AttackAttemptTelemetry;
}

export interface ThreeSingleAttackSessionSnapshot {
  readonly runId: string;
  readonly sessionStartedAtMs: number | undefined;
  readonly nowMs: number;
  readonly currentComboIndex: number;
  readonly currentAttackIndex: number;
  readonly currentAttack: AttackAttemptSnapshot;
  readonly scheduledAttacks: readonly ScheduledSessionAttack[];
  readonly results: readonly SessionAttackResult[];
  readonly latestResult: SessionAttackResult | undefined;
  readonly sessionCompleted: boolean;
}

export class P0ThreeSingleAttackSession {
  private readonly clock: GameClock;
  private readonly motionSourceIds: Readonly<Record<string, string>>;
  private readonly plans: readonly AttackPlan[];
  private runNumber = 1;
  private sessionStartedAtMs: number | undefined;
  private attacks: readonly RunningAttack[];
  private results: readonly SessionAttackResult[] = [];

  constructor(clock: GameClock, motionSourceIds: Readonly<Record<string, string>>) {
    this.clock = clock;
    this.motionSourceIds = motionSourceIds;
    this.plans = buildAttackPlans();
    this.validateMotionSources();
    this.attacks = this.createRunAttacks();
  }

  start({ leadInMs = 0 }: AttackAttemptStartOptions = {}): void {
    if (this.sessionStartedAtMs != null) {
      throw new Error('Three-attack session has already started');
    }
    if (!Number.isFinite(leadInMs) || leadInMs < 0) {
      throw new Error('Session lead-in must be a finite non-negative duration');
    }

    this.sessionStartedAtMs = this.clock.nowMs();
    for (const attack of this.attacks) {
      attack.controller.start({ leadInMs: leadInMs + attack.offsetFromSessionStartMs });
    }
  }

  retry(options: AttackAttemptStartOptions = {}): void {
    if (!this.snapshot().sessionCompleted) {
      throw new Error('Session can only retry after all attacks resolve');
    }

    this.runNumber += 1;
    this.sessionStartedAtMs = undefined;
    this.results = [];
    this.attacks = this.createRunAttacks();
    this.start(options);
  }

  tick(): ThreeSingleAttackSessionSnapshot {
    for (const attack of this.attacks) {
      attack.controller.tick();
    }
    this.collectResults();
    return this.snapshot();
  }

  handleInput(input: DefenseInput): AttackAttemptInputReceipt {
    if (this.results.length === this.attacks.length) {
      throw new Error('Completed session cannot accept defense input');
    }
    return this.currentRunningAttack().controller.handleInput(input);
  }

  snapshot(): ThreeSingleAttackSessionSnapshot {
    const currentIndex = this.currentAttackIndex();
    const current = this.attacks[currentIndex];
    if (current == null) {
      throw new Error('Three-attack session requires at least one canonical attack');
    }

    return {
      runId: this.runId,
      sessionStartedAtMs: this.sessionStartedAtMs,
      nowMs: this.clock.nowMs(),
      currentComboIndex: current.comboIndex,
      currentAttackIndex: currentIndex,
      currentAttack: current.controller.snapshot(),
      scheduledAttacks: this.attacks.map((attack) => ({
        comboId: attack.comboId,
        comboIndex: attack.comboIndex,
        attackIndex: attack.attackIndex,
        attackId: attack.attack.attackId,
        attackInstanceId: attack.attackInstanceId,
        attackStartScheduledAtMs: attack.controller.snapshot().attackStartScheduledAtMs,
      })),
      results: this.results,
      latestResult: this.results.at(-1),
      sessionCompleted: this.results.length === this.attacks.length,
    };
  }

  private get runId(): string {
    return `run-${this.runNumber}`;
  }

  private createRunAttacks(): readonly RunningAttack[] {
    return this.plans.map((plan) => {
      const attackInstanceId = `${this.runId}:combo-${plan.comboIndex}:attack-${plan.attackIndex}`;
      return {
        ...plan,
        attackInstanceId,
        controller: new P0AttackAttemptController({
          attack: plan.attack,
          attackInstanceId,
          motionSourceId: this.motionSourceIds[plan.attack.attackId]!,
          clock: this.clock,
          timelineMode: 'ABSOLUTE_SCHEDULE',
        }),
      };
    });
  }

  private currentAttackIndex(): number {
    const unresolvedIndex = this.attacks.findIndex(
      (attack) => attack.controller.snapshot().gameState !== 'FINISHED',
    );
    return unresolvedIndex === -1 ? this.attacks.length - 1 : unresolvedIndex;
  }

  private currentRunningAttack(): RunningAttack {
    const current = this.attacks[this.currentAttackIndex()];
    if (current == null) {
      throw new Error('No current attack is available');
    }
    return current;
  }

  private collectResults(): void {
    const knownInstanceIds = new Set(this.results.map((result) => result.attackInstanceId));
    const newlyResolved = this.attacks.flatMap((attack) => {
      const snapshot = attack.controller.snapshot();
      if (
        snapshot.outcome == null ||
        snapshot.telemetry == null ||
        knownInstanceIds.has(attack.attackInstanceId)
      ) {
        return [];
      }
      return [
        {
          comboId: attack.comboId,
          comboIndex: attack.comboIndex,
          attackIndex: attack.attackIndex,
          attackId: attack.attack.attackId,
          attackInstanceId: attack.attackInstanceId,
          outcome: snapshot.outcome,
          telemetry: snapshot.telemetry,
        } satisfies SessionAttackResult,
      ];
    });
    this.results = [...this.results, ...newlyResolved];
  }

  private validateMotionSources(): void {
    for (const plan of this.plans) {
      const sourceId = this.motionSourceIds[plan.attack.attackId];
      if (typeof sourceId !== 'string' || sourceId.length === 0) {
        throw new Error(`Missing motion source for ${plan.attack.attackId}`);
      }
    }
  }
}

function buildAttackPlans(): readonly AttackPlan[] {
  const plans: AttackPlan[] = [];
  let comboStartOffsetMs = 0;

  P0_SEQUENCE.slice(0, SINGLE_ATTACK_COMBO_COUNT).forEach((combo, comboIndex) => {
    combo.attacks.forEach((attack, attackIndex) => {
      plans.push({
        comboId: combo.comboId,
        comboIndex,
        attackIndex,
        attack,
        offsetFromSessionStartMs: comboStartOffsetMs + combo.attackStartOffsetsMs[attackIndex]!,
      });
    });

    const comboDurationMs = Math.max(
      ...combo.attacks.map(
        (attack, attackIndex) => combo.attackStartOffsetsMs[attackIndex]! + attack.impactMs,
      ),
    );
    comboStartOffsetMs += comboDurationMs + combo.recoveryAfterMs;
  });

  return plans;
}
