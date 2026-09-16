import type { DefenseInput, DefenseOutcome, InputStatus } from '../model/types.js';

export interface P0AttackTelemetry {
  attackInstanceId: string;
  comboId: string;
  comboIndex: number;
  animationStartActualMs: number;
  cueAnchorActualMs: number;
  impactActualMs: number;
  inputTimestampMs?: number;
  inputButton?: DefenseInput;
  inputStatus: InputStatus;
  defenseOutcome: DefenseOutcome;
  reactionMs?: number;
  frameTimeAroundCueMs?: number;
  droppedFrameDetected?: boolean;
}

export class P0TelemetryBuffer {
  private readonly events: P0AttackTelemetry[] = [];

  record(event: P0AttackTelemetry): void {
    this.events.push({ ...event });
  }

  snapshot(): readonly P0AttackTelemetry[] {
    return this.events.map((event) => ({ ...event }));
  }

  clear(): void {
    this.events.length = 0;
  }
}
