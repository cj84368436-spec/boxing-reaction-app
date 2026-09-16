import { P0_ATTACKS } from '../../game/config/p0Attacks';
import type { GameClock } from '../../game/engine/GameClock';
import { P0AttackAttemptController } from '../session/P0AttackAttemptController';
import { P0LeadJabSession } from '../session/P0LeadJabSession';
import { P0SingleAttackSession } from '../session/P0SingleAttackSession';

class ManualClock implements GameClock {
  constructor(private valueMs = 0) {}

  nowMs(): number {
    return this.valueMs;
  }

  set(valueMs: number): void {
    this.valueMs = valueMs;
  }
}

function runningAttempt() {
  const clock = new ManualClock(0);
  const controller = new P0AttackAttemptController({
    attack: P0_ATTACKS.LEAD_JAB_HEAD,
    attackInstanceId: 'contract-jab:0',
    motionSourceId: '144_13',
    clock,
  });
  controller.start({ leadInMs: 0 });
  controller.tick();
  return { clock, controller };
}

describe('P0AttackAttemptController', () => {
  it('runs canonical Lead Jab routing, resolution, and telemetry through the shared controller', () => {
    const { clock, controller } = runningAttempt();

    expect(controller.snapshot()).toEqual(
      expect.objectContaining({
        cueAtMs: 120,
        responseStartAtMs: 120,
        responseEndAtMs: 450,
        impactAtMs: 480,
      }),
    );

    clock.set(200);
    expect(controller.handleInput('RIGHT').status).toBe('VALID');
    clock.set(480);
    controller.tick();

    expect(controller.snapshot()).toEqual(
      expect.objectContaining({
        outcome: 'PERFECT',
        telemetry: expect.objectContaining({
          attackId: 'LEAD_JAB_HEAD',
          attackInstanceId: 'contract-jab:0',
          inputStatus: 'VALID',
          defenseOutcome: 'PERFECT',
          motionSourceId: '144_13',
        }),
      }),
    );
  });

  it('resolves a shared-controller attempt without input as NO_INPUT and HIT', () => {
    const { clock, controller } = runningAttempt();

    clock.set(480);
    controller.tick();

    expect(controller.snapshot().outcome).toBe('HIT');
    expect(controller.snapshot().telemetry).toEqual(
      expect.objectContaining({ inputStatus: 'NO_INPUT', defenseOutcome: 'HIT' }),
    );
    expect(controller.snapshot().telemetry?.inputButton).toBeUndefined();
  });

  it('accepts one pre-routed buffered press for its own future attack instance', () => {
    const clock = new ManualClock(0);
    const controller = new P0AttackAttemptController({
      attack: P0_ATTACKS.LEAD_HOOK_HEAD,
      attackInstanceId: 'combo-0:attack-1',
      motionSourceId: '14_01',
      clock,
      timelineMode: 'ABSOLUTE_SCHEDULE',
    });
    controller.start({ leadInMs: 650 });

    controller.acceptRoutedInput({
      kind: 'BUTTON',
      atMs: 740,
      input: 'RIGHT',
      status: 'VALID',
      targetAttackInstanceId: 'combo-0:attack-1',
      buffered: true,
    });
    clock.set(1_270);
    controller.tick();

    expect(controller.snapshot()).toEqual(
      expect.objectContaining({
        inputButton: 'RIGHT',
        inputStatus: 'VALID',
        outcome: 'PERFECT',
      }),
    );
  });

  it('keeps the production Lead Jab wrapper on the shared single-attack session', () => {
    const session = new P0LeadJabSession(new ManualClock());

    expect(session).toBeInstanceOf(P0SingleAttackSession);
  });
});
