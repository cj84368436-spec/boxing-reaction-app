import type { GameClock } from '../../game/engine/GameClock.js';
import type { AttackDefinition, DefenseInput } from '../../game/model/types.js';
import {
  P0AttackAttemptController,
  type AttackAttemptInputReceipt,
  type AttackAttemptSnapshot,
  type AttackAttemptStartOptions,
} from './P0AttackAttemptController.js';

export interface SingleAttackSessionConfig {
  readonly attack: AttackDefinition;
  readonly attackInstanceIdPrefix: string;
  readonly motionSourceId: string;
  readonly clock: GameClock;
  readonly defaultLeadInMs: number;
}

export class P0SingleAttackSession {
  private readonly config: SingleAttackSessionConfig;
  private instanceIndex = 0;
  private attempt: P0AttackAttemptController;

  constructor(config: SingleAttackSessionConfig) {
    if (config.attackInstanceIdPrefix.length === 0) {
      throw new Error('Attack instance ID prefix must not be empty');
    }
    this.config = config;
    this.attempt = this.createAttempt();
  }

  start(options: AttackAttemptStartOptions = {}): void {
    this.attempt.start({ leadInMs: options.leadInMs ?? this.config.defaultLeadInMs });
  }

  retry(options: AttackAttemptStartOptions = {}): void {
    if (this.attempt.snapshot().gameState !== 'FINISHED') {
      throw new Error('Attack can only retry after resolution');
    }

    this.instanceIndex += 1;
    this.attempt = this.createAttempt();
    this.start(options);
  }

  tick(): AttackAttemptSnapshot {
    return this.attempt.tick();
  }

  handleInput(input: DefenseInput): AttackAttemptInputReceipt {
    return this.attempt.handleInput(input);
  }

  snapshot(): AttackAttemptSnapshot {
    return this.attempt.snapshot();
  }

  private createAttempt(): P0AttackAttemptController {
    return new P0AttackAttemptController({
      attack: this.config.attack,
      attackInstanceId: `${this.config.attackInstanceIdPrefix}:${this.instanceIndex}`,
      motionSourceId: this.config.motionSourceId,
      clock: this.config.clock,
    });
  }
}
