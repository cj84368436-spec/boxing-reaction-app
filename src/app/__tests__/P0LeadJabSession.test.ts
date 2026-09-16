import type { GameClock } from '../../game/engine/GameClock';
import { P0LeadJabSession } from '../session/P0LeadJabSession';

class ManualClock implements GameClock {
  constructor(private valueMs = 0) {}

  nowMs(): number {
    return this.valueMs;
  }

  set(valueMs: number): void {
    this.valueMs = valueMs;
  }
}

function runningSession() {
  const clock = new ManualClock(0);
  const session = new P0LeadJabSession(clock);
  session.start({ leadInMs: 0 });
  session.tick();
  return { clock, session };
}

describe('P0LeadJabSession canonical integration', () => {
  it('derives the single Lead Jab window from canonical 120/480/120-450 timing', () => {
    const { session } = runningSession();
    const snapshot = session.snapshot();

    expect(snapshot.attackStartAtMs).toBe(0);
    expect(snapshot.cueAtMs).toBe(120);
    expect(snapshot.responseStartAtMs).toBe(120);
    expect(snapshot.responseEndAtMs).toBe(450);
    expect(snapshot.impactAtMs).toBe(480);
  });

  it('uses the canonical state machine from READY through attack to FINISHED', () => {
    const clock = new ManualClock(0);
    const session = new P0LeadJabSession(clock);

    expect(session.snapshot().gameState).toBe('READY');
    session.start({ leadInMs: 100 });
    expect(session.snapshot().gameState).toBe('COUNTDOWN');

    clock.set(100);
    session.tick();
    expect(session.snapshot().gameState).toBe('ATTACK_PREP');

    clock.set(220);
    session.tick();
    expect(session.snapshot().gameState).toBe('RESPONSE_WINDOW');

    clock.set(580);
    session.tick();
    expect(session.snapshot().gameState).toBe('FINISHED');
  });

  it('routes a response-window press to the current explicit attack instance', () => {
    const { clock, session } = runningSession();
    clock.set(200);

    expect(session.handleInput('LEFT')).toEqual(
      expect.objectContaining({
        kind: 'BUTTON',
        status: 'VALID',
        input: 'LEFT',
        atMs: 200,
        targetAttackInstanceId: 'single-jab:0',
      }),
    );
  });

  it('passes a valid slip through the canonical resolver as PERFECT at impact', () => {
    const { clock, session } = runningSession();
    clock.set(200);
    session.handleInput('RIGHT');
    clock.set(480);
    session.tick();

    expect(session.snapshot().outcome).toBe('PERFECT');
  });

  it('passes a valid guard through the canonical resolver as SAFE at impact', () => {
    const { clock, session } = runningSession();
    clock.set(240);
    session.handleInput('GUARD');
    clock.set(480);
    session.tick();

    expect(session.snapshot().outcome).toBe('SAFE');
  });

  it('resolves no response-window input as NO_INPUT and HIT without a fake button', () => {
    const { clock, session } = runningSession();
    clock.set(480);
    session.tick();
    const telemetry = session.snapshot().telemetry;

    expect(session.snapshot().outcome).toBe('HIT');
    expect(telemetry?.inputStatus).toBe('NO_INPUT');
    expect(telemetry?.inputButton).toBeUndefined();
    expect(telemetry?.inputAtMs).toBeUndefined();
  });

  it('preserves an EARLY input and resolves it as HIT when no valid input follows', () => {
    const { clock, session } = runningSession();
    clock.set(119);
    expect(session.handleInput('BACK').status).toBe('EARLY');
    clock.set(480);
    session.tick();

    expect(session.snapshot().outcome).toBe('HIT');
    expect(session.snapshot().telemetry?.inputStatus).toBe('EARLY');
  });

  it('preserves a LATE input and resolves it as HIT', () => {
    const { clock, session } = runningSession();
    clock.set(451);
    expect(session.handleInput('LEFT').status).toBe('LATE');
    clock.set(480);
    session.tick();

    expect(session.snapshot().outcome).toBe('HIT');
    expect(session.snapshot().telemetry?.inputStatus).toBe('LATE');
  });

  it('preserves same-instance simultaneous different buttons as MULTI_INPUT and HIT', () => {
    const { clock, session } = runningSession();
    clock.set(200);
    session.handleInput('LEFT');
    clock.set(235);
    expect(session.handleInput('RIGHT').status).toBe('MULTI_INPUT');
    clock.set(480);
    session.tick();

    expect(session.snapshot().outcome).toBe('HIT');
    expect(session.snapshot().telemetry?.inputStatus).toBe('MULTI_INPUT');
  });

  it('does not classify the same button twice as MULTI_INPUT', () => {
    const { clock, session } = runningSession();
    clock.set(200);
    session.handleInput('LEFT');
    clock.set(220);

    expect(session.handleInput('LEFT').status).toBe('VALID');
  });

  it('retry creates a new attack instance and clears the previous input and result', () => {
    const { clock, session } = runningSession();
    clock.set(200);
    session.handleInput('LEFT');
    clock.set(480);
    session.tick();
    expect(session.snapshot().outcome).toBe('PERFECT');

    clock.set(1000);
    session.retry({ leadInMs: 0 });
    session.tick();
    const retried = session.snapshot();

    expect(retried.attackInstanceId).toBe('single-jab:1');
    expect(retried.outcome).toBeUndefined();
    expect(retried.inputButton).toBeUndefined();
    expect(retried.inputStatus).toBeUndefined();
    expect(retried.telemetry).toBeUndefined();
  });

  it('resolves from GameClock impact time without any animation completion signal', () => {
    const { clock, session } = runningSession();
    clock.set(479);
    session.tick();
    expect(session.snapshot().outcome).toBeUndefined();

    clock.set(480);
    session.tick();
    expect(session.snapshot().outcome).toBe('HIT');
  });

  it('records scheduled and actual clock milestones plus canonical motion source', () => {
    const clock = new ManualClock(0);
    const session = new P0LeadJabSession(clock);
    session.start({ leadInMs: 10 });
    clock.set(14);
    session.tick();
    clock.set(140);
    session.tick();
    clock.set(220);
    session.handleInput('BACK');
    clock.set(500);
    session.tick();

    expect(session.snapshot().telemetry).toEqual({
      attackId: 'LEAD_JAB_HEAD',
      attackInstanceId: 'single-jab:0',
      attackStartScheduledAtMs: 10,
      attackStartActualAtMs: 14,
      cueScheduledAtMs: 134,
      cueActualAtMs: 140,
      impactScheduledAtMs: 494,
      impactActualAtMs: 500,
      inputAtMs: 220,
      inputButton: 'BACK',
      inputStatus: 'VALID',
      reactionMs: 86,
      defenseOutcome: 'SAFE',
      motionSourceId: '144_13',
    });
  });
});
