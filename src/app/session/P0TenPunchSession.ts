import { candidatePatterns, GUARD_CAPACITY } from './candidateRules.js';
import { P0_SEQUENCE } from '../../game/config/p0Sequence.js';
import { P0_TIMING } from '../../game/config/p0Timing.js';
import type { GameClock } from '../../game/engine/GameClock.js';
import { routeInput } from '../../game/engine/InputRouter.js';
import type {
  AttackDefinition,
  AttackWindow,
  DefenseInput,
  DefenseOutcome,
} from '../../game/model/types.js';
import {
  P0AttackAttemptController,
  type AttackAttemptInputReceipt,
  type AttackAttemptSnapshot,
  type AttackAttemptStartOptions,
  type AttackAttemptTelemetry,
} from './P0AttackAttemptController.js';
import { createSeededComboOrder } from './seededComboOrder.js';

interface AttackPlan {
  readonly comboId: string;
  readonly comboIndex: number;
  readonly comboAttackIndex: number;
  readonly attackIndex: number;
  readonly attack: AttackDefinition;
  readonly offsetFromSessionStartMs: number;
}

interface RunningAttack extends AttackPlan {
  readonly attackInstanceId: string;
  readonly controller: P0AttackAttemptController;
}

export interface TenPunchSessionAttack {
  readonly comboId: string;
  readonly comboIndex: number;
  readonly comboAttackIndex: number;
  readonly attackIndex: number;
  readonly attackId: string;
  readonly attackInstanceId: string;
  readonly attackStartScheduledAtMs: number | undefined;
}

export interface TenPunchSessionResult extends TenPunchSessionAttack {
  readonly outcome: DefenseOutcome;
  readonly telemetry: AttackAttemptTelemetry;
}

export interface TenPunchSessionSnapshot {
  readonly ruleset?: 'candidate' | 'baseline';
  readonly guardEnergy?: number;
  readonly runId: string;
  readonly seed: number;
  readonly comboOrderIds: readonly string[];
  readonly flattenedAttackOrder: readonly string[];
  readonly sessionStartedAtMs: number | undefined;
  readonly nowMs: number;
  readonly currentComboIndex: number;
  readonly currentAttackIndex: number;
  readonly currentAttack: AttackAttemptSnapshot;
  readonly scheduledAttacks: readonly TenPunchSessionAttack[];
  readonly results: readonly TenPunchSessionResult[];
  readonly latestResult: TenPunchSessionResult | undefined;
  readonly sessionCompleted: boolean;
}

interface TenPunchSessionOptions {
  readonly ruleset?: 'candidate' | 'baseline';
  readonly seed?: number;
  readonly seedFactory?: () => number;
}

interface TenPunchRetryOptions extends AttackAttemptStartOptions {
  readonly seed?: number;
}

const DEFAULT_SEED_FACTORY = () => Date.now() >>> 0;

export class P0TenPunchSession {
  private readonly clock: GameClock;
  private readonly motionSourceIds: Readonly<Record<string, string>>;
  private readonly seedFactory: () => number;
  private runNumber = 1;
  private readonly ruleset: 'candidate' | 'baseline';
  private guardEnergy = GUARD_CAPACITY;
  private seed: number;
  private plans: readonly AttackPlan[];
  private comboOrderIds: readonly string[];
  private sessionStartedAtMs: number | undefined;
  private attacks: readonly RunningAttack[];
  private results: readonly TenPunchSessionResult[] = [];

  constructor(
    clock: GameClock,
    motionSourceIds: Readonly<Record<string, string>>,
    options: TenPunchSessionOptions = {},
  ) {
    this.clock = clock;
    this.ruleset = options.ruleset ?? 'baseline';
    this.motionSourceIds = motionSourceIds;
    this.seedFactory = options.seedFactory ?? DEFAULT_SEED_FACTORY;
    this.seed = this.normalizeSeed(options.seed ?? this.seedFactory());
    const runPlan = this.createRunPlan();
    this.plans = runPlan.plans;
    this.comboOrderIds = runPlan.comboOrderIds;
    this.validateMotionSources();
    this.attacks = this.createRunAttacks();
  }

  start({ leadInMs = 0 }: AttackAttemptStartOptions = {}): void {
    if (this.sessionStartedAtMs != null) {
      throw new Error('Ten-punch session has already started');
    }
    if (!Number.isFinite(leadInMs) || leadInMs < 0) {
      throw new Error('Session lead-in must be a finite non-negative duration');
    }

    this.sessionStartedAtMs = this.clock.nowMs();
    for (const attack of this.attacks) {
      attack.controller.start({ leadInMs: leadInMs + attack.offsetFromSessionStartMs });
    }
  }

  retry({ leadInMs = 0, seed }: TenPunchRetryOptions = {}): void {
    if (!this.snapshot().sessionCompleted) {
      throw new Error('Session can only retry after all attacks resolve');
    }

    this.runNumber += 1;
    this.guardEnergy = GUARD_CAPACITY;
    this.seed = this.normalizeSeed(seed ?? this.seedFactory());
    const runPlan = this.createRunPlan();
    this.plans = runPlan.plans;
    this.comboOrderIds = runPlan.comboOrderIds;
    this.sessionStartedAtMs = undefined;
    this.results = [];
    this.validateMotionSources();
    this.attacks = this.createRunAttacks();
    this.start({ leadInMs });
  }

  tick(): TenPunchSessionSnapshot {
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

    const unresolvedIndex = this.currentAttackIndex();
    const unresolved = this.attacks[unresolvedIndex]!;
    const unresolvedWindow = this.windowFor(unresolved);
    const nowMs = this.clock.nowMs();
    const previous = unresolvedIndex > 0 ? this.attacks[unresolvedIndex - 1] : undefined;
    const usePreviousAsCurrent = previous != null && nowMs < unresolvedWindow.responseStartAtMs;
    const routingCurrent = usePreviousAsCurrent ? previous : unresolved;
    const routingNext = usePreviousAsCurrent
      ? unresolved
      : this.attacks[unresolvedIndex + 1];
    const routed = routeInput(
      { atMs: nowMs, input },
      {
        current: this.windowFor(routingCurrent),
        currentResolved: routingCurrent.controller.snapshot().outcome != null,
        ...(routingNext == null ? {} : { next: this.windowFor(routingNext) }),
        preCueBufferMs: P0_TIMING.preCueBufferMs,
      },
    );

    if (routed.status === 'VALID') {
      const target = this.attacks.find(
        (attack) => attack.attackInstanceId === routed.targetAttackInstanceId,
      );
      if (target == null) {
        throw new Error(`No attack controller for ${routed.targetAttackInstanceId}`);
      }
      return target.controller.acceptRoutedInput(routed);
    }

    return unresolved.controller.handleInput(input);
  }

  snapshot(): TenPunchSessionSnapshot {
    const currentIndex = this.currentAttackIndex();
    const current = this.attacks[currentIndex];
    if (current == null) {
      throw new Error('Ten-punch session requires canonical attacks');
    }

    return {
      ruleset: this.ruleset,
      guardEnergy: this.guardEnergy,
      runId: this.runId,
      seed: this.seed,
      comboOrderIds: this.comboOrderIds,
      flattenedAttackOrder: this.plans.map((plan) => plan.attack.attackId),
      sessionStartedAtMs: this.sessionStartedAtMs,
      nowMs: this.clock.nowMs(),
      currentComboIndex: current.comboIndex,
      currentAttackIndex: current.attackIndex,
      currentAttack: current.controller.snapshot(),
      scheduledAttacks: this.attacks.map((attack) => ({
        comboId: attack.comboId,
        comboIndex: attack.comboIndex,
        comboAttackIndex: attack.comboAttackIndex,
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

  private normalizeSeed(seed: number): number {
    if (!Number.isFinite(seed) || !Number.isInteger(seed)) {
      throw new Error('Playtest seed must be a finite integer');
    }
    return seed >>> 0;
  }

  private createRunPlan(): { plans: readonly AttackPlan[]; comboOrderIds: readonly string[] } {
    const comboOrder = this.ruleset === 'candidate' ? candidatePatterns(this.seed) : createSeededComboOrder(P0_SEQUENCE, this.seed);
    const plans: AttackPlan[] = [];
    let comboStartOffsetMs = 0;

    comboOrder.forEach((combo, comboIndex) => {
      combo.attacks.forEach((attack, comboAttackIndex) => {
        plans.push({
          comboId: combo.comboId,
          comboIndex,
          comboAttackIndex,
          attackIndex: plans.length,
          attack,
          offsetFromSessionStartMs:
            comboStartOffsetMs + combo.attackStartOffsetsMs[comboAttackIndex]!,
        });
      });

      const comboDurationMs = Math.max(
        ...combo.attacks.map(
          (attack, comboAttackIndex) =>
            combo.attackStartOffsetsMs[comboAttackIndex]! + attack.impactMs,
        ),
      );
      comboStartOffsetMs += comboDurationMs + combo.recoveryAfterMs;
    });

    return { plans, comboOrderIds: comboOrder.map((combo) => combo.comboId) };
  }

  private createRunAttacks(): readonly RunningAttack[] {
    return this.plans.map((plan) => {
      const attackInstanceId =
        `${this.runId}:combo-${plan.comboIndex}:attack-${plan.comboAttackIndex}`;
      return {
        ...plan,
        attackInstanceId,
        controller: new P0AttackAttemptController({
          attack: plan.attack,
          attackInstanceId,
          motionSourceId: this.motionSourceIds[plan.attack.attackId]!,
          clock: this.clock,
          timelineMode: 'ABSOLUTE_SCHEDULE',
          ...(this.ruleset !== 'candidate' ? {} : { allowEarlyRecovery: true, resolveInput: (input: DefenseInput): DefenseOutcome => {
            if (input === 'GUARD') {
              if (this.guardEnergy === 0) return 'HIT';
              this.guardEnergy--; return 'SAFE';
            }
            const outcome = plan.attack.defenseMatrix[input];
            if (outcome !== 'HIT') this.guardEnergy = Math.min(GUARD_CAPACITY, this.guardEnergy + 1);
            return outcome;
          }}),
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

  private windowFor(attack: RunningAttack): AttackWindow {
    const snapshot = attack.controller.snapshot();
    if (
      snapshot.cueAtMs == null ||
      snapshot.responseStartAtMs == null ||
      snapshot.responseEndAtMs == null ||
      snapshot.impactAtMs == null
    ) {
      throw new Error(`Attack window not scheduled for ${attack.attackInstanceId}`);
    }
    return {
      attackInstanceId: attack.attackInstanceId,
      cueAtMs: snapshot.cueAtMs,
      responseStartAtMs: snapshot.responseStartAtMs,
      responseEndAtMs: snapshot.responseEndAtMs,
      impactAtMs: snapshot.impactAtMs,
    };
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
      return [{
        comboId: attack.comboId,
        comboIndex: attack.comboIndex,
        comboAttackIndex: attack.comboAttackIndex,
        attackIndex: attack.attackIndex,
        attackId: attack.attack.attackId,
        attackInstanceId: attack.attackInstanceId,
        attackStartScheduledAtMs: snapshot.attackStartScheduledAtMs,
        outcome: snapshot.outcome,
        telemetry: snapshot.telemetry,
      } satisfies TenPunchSessionResult];
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
