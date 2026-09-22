import { EARLY_RECOVERY_MS } from './candidateRules.js';
import { P0_TIMING } from '../../game/config/p0Timing.js';
import { resolveDefense } from '../../game/engine/DefenseResolver.js';
import type { GameClock } from '../../game/engine/GameClock.js';
import { GameStateMachine, type GameState } from '../../game/engine/GameStateMachine.js';
import { detectMultiInput, routeInput } from '../../game/engine/InputRouter.js';
import type {
  AttackDefinition,
  AttackWindow,
  DefenseInput,
  DefenseOutcome,
  InputStatus,
  RejectedRoutedButtonInput,
  RoutedButtonInput,
  ValidRoutedButtonInput,
} from '../../game/model/types.js';

export interface AttackAttemptTelemetry {
  readonly attackId: string;
  readonly attackInstanceId: string;
  readonly attackStartScheduledAtMs: number;
  readonly attackStartActualAtMs: number;
  readonly cueScheduledAtMs: number;
  readonly cueActualAtMs: number;
  readonly impactScheduledAtMs: number;
  readonly impactActualAtMs: number;
  readonly inputAtMs?: number;
  readonly inputButton?: DefenseInput;
  readonly inputStatus: InputStatus;
  readonly reactionMs?: number;
  readonly defenseOutcome: DefenseOutcome;
  readonly motionSourceId: string;
}

export interface MultiInputReceipt {
  readonly kind: 'BUTTON';
  readonly atMs: number;
  readonly input: DefenseInput;
  readonly status: 'MULTI_INPUT';
  readonly targetAttackInstanceId: string;
  readonly buffered: false;
}

export type AttackAttemptInputReceipt = RoutedButtonInput | MultiInputReceipt;

export interface AttackAttemptSnapshot {
  readonly gameState: GameState;
  readonly attackId: string;
  readonly attackInstanceId: string;
  readonly nowMs: number;
  readonly attackStartScheduledAtMs?: number | undefined;
  readonly attackStartAtMs?: number | undefined;
  readonly cueAtMs?: number | undefined;
  readonly responseStartAtMs?: number | undefined;
  readonly responseEndAtMs?: number | undefined;
  readonly impactAtMs?: number | undefined;
  readonly elapsedMs: number;
  readonly inputButton?: DefenseInput | undefined;
  readonly inputAtMs?: number | undefined;
  readonly inputStatus?: InputStatus | undefined;
  readonly outcome?: DefenseOutcome | undefined;
  readonly telemetry?: AttackAttemptTelemetry | undefined;
}

export interface AttackAttemptStartOptions {
  readonly leadInMs?: number;
}

export interface AttackAttemptControllerConfig {
  readonly allowEarlyRecovery?: boolean;
  readonly resolveInput?: (input: DefenseInput) => DefenseOutcome;
  readonly attack: AttackDefinition;
  readonly attackInstanceId: string;
  readonly motionSourceId: string;
  readonly clock: GameClock;
  readonly timelineMode?: 'RELATIVE_TO_ACTUAL_START' | 'ABSOLUTE_SCHEDULE';
}

export class P0AttackAttemptController {
  private readonly allowEarlyRecovery: boolean;
  private readonly resolveInput: ((input: DefenseInput) => DefenseOutcome) | undefined;
  private readonly attack: AttackDefinition;
  private readonly attackInstanceId: string;
  private readonly motionSourceId: string;
  private readonly clock: GameClock;
  private readonly timelineMode: 'RELATIVE_TO_ACTUAL_START' | 'ABSOLUTE_SCHEDULE';
  private stateMachine = new GameStateMachine();
  private started = false;
  private attackStartScheduledAtMs?: number;
  private attackStartActualAtMs?: number;
  private attackWindow?: AttackWindow;
  private cueActualAtMs?: number;
  private selectedInput?: ValidRoutedButtonInput;
  private rejectedInput?: RejectedRoutedButtonInput;
  private multiInput?: MultiInputReceipt;
  private outcome?: DefenseOutcome;
  private telemetry?: AttackAttemptTelemetry;

  constructor(config: AttackAttemptControllerConfig) {
    this.attack = config.attack;
    this.allowEarlyRecovery = config.allowEarlyRecovery ?? false;
    this.resolveInput = config.resolveInput;
    this.attackInstanceId = config.attackInstanceId;
    this.motionSourceId = config.motionSourceId;
    this.clock = config.clock;
    this.timelineMode = config.timelineMode ?? 'RELATIVE_TO_ACTUAL_START';
  }

  start({ leadInMs = 0 }: AttackAttemptStartOptions = {}): void {
    if (this.started || this.stateMachine.current !== 'READY') {
      throw new Error('Attack attempt has already started');
    }
    if (!Number.isFinite(leadInMs) || leadInMs < 0) {
      throw new Error('Attack lead-in must be a finite non-negative duration');
    }

    this.started = true;
    this.attackStartScheduledAtMs = this.clock.nowMs() + leadInMs;
    this.attackWindow = {
      attackInstanceId: this.attackInstanceId,
      cueAtMs: this.attackStartScheduledAtMs + this.attack.cueAnchorMs,
      responseStartAtMs: this.attackStartScheduledAtMs + this.attack.responseWindowStartMs,
      responseEndAtMs: this.attackStartScheduledAtMs + this.attack.responseWindowEndMs,
      impactAtMs: this.attackStartScheduledAtMs + this.attack.impactMs,
    };
    this.stateMachine.transition('COUNTDOWN');
  }

  tick(): AttackAttemptSnapshot {
    const nowMs = this.clock.nowMs();

    if (
      this.stateMachine.current === 'COUNTDOWN' &&
      this.attackStartScheduledAtMs != null &&
      nowMs >= this.attackStartScheduledAtMs
    ) {
      this.attackStartActualAtMs = nowMs;
      const timelineStartAtMs =
        this.timelineMode === 'ABSOLUTE_SCHEDULE'
          ? this.attackStartScheduledAtMs
          : this.attackStartActualAtMs;
      this.attackWindow = {
        attackInstanceId: this.attackInstanceId,
        cueAtMs: timelineStartAtMs + this.attack.cueAnchorMs,
        responseStartAtMs: timelineStartAtMs + this.attack.responseWindowStartMs,
        responseEndAtMs: timelineStartAtMs + this.attack.responseWindowEndMs,
        impactAtMs: timelineStartAtMs + this.attack.impactMs,
      };
      this.stateMachine.transition('ATTACK_PREP');
    }

    if (
      this.stateMachine.current === 'ATTACK_PREP' &&
      this.attackWindow != null &&
      nowMs >= this.attackWindow.responseStartAtMs
    ) {
      this.cueActualAtMs = nowMs;
      this.stateMachine.transition('RESPONSE_WINDOW');
    }

    if (
      this.stateMachine.current === 'RESPONSE_WINDOW' &&
      this.attackWindow != null &&
      nowMs >= this.attackWindow.impactAtMs
    ) {
      this.stateMachine.transition('RESOLVE');
      this.resolveAt(nowMs);
      this.stateMachine.transition('FINISHED');
    }

    return this.snapshotAt(nowMs);
  }

  handleInput(input: DefenseInput): AttackAttemptInputReceipt {
    const atMs = this.clock.nowMs();
    this.recoverEarlyInput(atMs);
    if (this.attackWindow == null) {
      const early: RejectedRoutedButtonInput = {
        kind: 'BUTTON',
        atMs,
        input,
        status: 'EARLY',
        buffered: false,
      };
      return early;
    }

    const routed = routeInput(
      { atMs, input },
      {
        current: this.attackWindow,
        currentResolved: this.outcome != null,
        preCueBufferMs: P0_TIMING.preCueBufferMs,
      },
    );

    if (routed.status !== 'VALID') {
      if (this.outcome != null) return routed;
      // Countdown presses do not spend the next punch. Once that punch starts,
      // its first early/late attempt is final; later spam cannot repair it.
      const committed = this.multiInput ?? this.selectedInput ?? this.rejectedInput;
      if (committed != null) return committed;
      const startAt = this.timelineMode === 'ABSOLUTE_SCHEDULE'
        ? this.attackStartScheduledAtMs : this.attackStartActualAtMs ?? this.attackStartScheduledAtMs;
      if (this.outcome == null && startAt != null && atMs >= startAt) this.rejectedInput = routed;
      return routed;
    }
    return this.acceptRoutedInput(routed);
  }

  acceptRoutedInput(input: ValidRoutedButtonInput): AttackAttemptInputReceipt {
    if (input.targetAttackInstanceId !== this.attackInstanceId) {
      throw new Error(`Input targeted ${input.targetAttackInstanceId}, not ${this.attackInstanceId}`);
    }
    if (this.outcome != null) {
      throw new Error('Finalized attack cannot accept input');
    }

    this.recoverEarlyInput(input.atMs);
    if (this.multiInput != null) return this.multiInput;
    if (this.rejectedInput != null) return this.rejectedInput;

    if (
      this.selectedInput != null &&
      detectMultiInput(this.selectedInput, input, P0_TIMING.simultaneousInputMs)
    ) {
      this.multiInput = {
        kind: 'BUTTON',
        atMs: input.atMs,
        input: input.input,
        status: 'MULTI_INPUT',
        targetAttackInstanceId: input.targetAttackInstanceId,
        buffered: false,
      };
      return this.multiInput;
    }

    this.selectedInput ??= input;
    return this.selectedInput;
  }

  snapshot(): AttackAttemptSnapshot {
    return this.snapshotAt(this.clock.nowMs());
  }

  private recoverEarlyInput(atMs: number): void {
    if (this.allowEarlyRecovery && this.rejectedInput?.status === 'EARLY' && atMs - this.rejectedInput.atMs >= EARLY_RECOVERY_MS) delete this.rejectedInput;
  }

  private resolveAt(impactActualAtMs: number): void {
    if (
      this.attackWindow == null ||
      this.attackStartScheduledAtMs == null ||
      this.attackStartActualAtMs == null
    ) {
      throw new Error('Attack attempt cannot resolve before attack start');
    }

    const chosen = this.multiInput ?? this.selectedInput ?? this.rejectedInput;
    const inputStatus: InputStatus = this.multiInput
      ? 'MULTI_INPUT'
      : this.selectedInput
        ? 'VALID'
        : this.rejectedInput?.status ?? 'NO_INPUT';
    const outcome =
      inputStatus === 'VALID' && this.selectedInput != null
        ? (this.resolveInput?.(this.selectedInput.input) ?? resolveDefense(this.attack, this.selectedInput.input))
        : 'HIT';

    this.outcome = outcome;
    this.telemetry = {
      attackId: this.attack.attackId,
      attackInstanceId: this.attackInstanceId,
      attackStartScheduledAtMs: this.attackStartScheduledAtMs,
      attackStartActualAtMs: this.attackStartActualAtMs,
      cueScheduledAtMs: this.attackWindow.cueAtMs,
      cueActualAtMs: this.cueActualAtMs ?? impactActualAtMs,
      impactScheduledAtMs: this.attackWindow.impactAtMs,
      impactActualAtMs,
      ...(chosen == null ? {} : { inputAtMs: chosen.atMs, inputButton: chosen.input }),
      inputStatus,
      ...(chosen == null
        ? {}
        : { reactionMs: chosen.atMs - this.attackWindow.responseStartAtMs }),
      defenseOutcome: outcome,
      motionSourceId: this.motionSourceId,
    };
  }

  private snapshotAt(nowMs: number): AttackAttemptSnapshot {
    const chosen = this.multiInput ?? this.selectedInput ?? this.rejectedInput;
    const inputStatus =
      this.telemetry?.inputStatus ??
      (this.multiInput
        ? 'MULTI_INPUT'
        : this.selectedInput?.status ?? this.rejectedInput?.status);

    return {
      gameState: this.stateMachine.current,
      attackId: this.attack.attackId,
      attackInstanceId: this.attackInstanceId,
      nowMs,
      attackStartScheduledAtMs: this.attackStartScheduledAtMs,
      attackStartAtMs: this.attackStartActualAtMs,
      cueAtMs: this.attackWindow?.cueAtMs,
      responseStartAtMs: this.attackWindow?.responseStartAtMs,
      responseEndAtMs: this.attackWindow?.responseEndAtMs,
      impactAtMs: this.attackWindow?.impactAtMs,
      elapsedMs:
        this.attackStartActualAtMs == null
          ? 0
          : Math.max(
              0,
              nowMs -
                (this.timelineMode === 'ABSOLUTE_SCHEDULE'
                  ? (this.attackStartScheduledAtMs ?? this.attackStartActualAtMs)
                  : this.attackStartActualAtMs),
            ),
      inputButton: chosen?.input,
      inputAtMs: chosen?.atMs,
      inputStatus,
      outcome: this.outcome,
      telemetry: this.telemetry,
    };
  }
}
