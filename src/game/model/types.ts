export type Hand = 'LEAD' | 'REAR';
export type PunchType = 'JAB' | 'STRAIGHT' | 'HOOK';
export type Target = 'HEAD';

export type DefenseInput = 'LEFT' | 'RIGHT' | 'BACK' | 'GUARD';
export type InputStatus = 'VALID' | 'EARLY' | 'LATE' | 'MULTI_INPUT' | 'NO_INPUT';
export type DefenseOutcome = 'PERFECT' | 'SAFE' | 'HIT';

export type DefenseMatrix = Readonly<Record<DefenseInput, DefenseOutcome>>;

export interface AttackDefinition {
  attackId: string;
  hand: Hand;
  punchType: PunchType;
  target: Target;
  animationId: string;
  cueAnchorMs: number;
  impactMs: number;
  responseWindowStartMs: number;
  responseWindowEndMs: number;
  speedTier: number;
  defenseMatrix: DefenseMatrix;
}

export interface AttackWindow {
  attackInstanceId: string;
  cueAtMs: number;
  responseStartAtMs: number;
  responseEndAtMs: number;
  impactAtMs: number;
}

export interface DefenseInputEvent {
  atMs: number;
  input: DefenseInput;
}

interface RoutedButtonInputBase extends DefenseInputEvent {
  kind: 'BUTTON';
  buffered: boolean;
}

export interface ValidRoutedButtonInput extends RoutedButtonInputBase {
  status: 'VALID';
  targetAttackInstanceId: string;
}

export interface RejectedRoutedButtonInput extends RoutedButtonInputBase {
  status: 'EARLY' | 'LATE';
  buffered: false;
}

export type RoutedButtonInput = ValidRoutedButtonInput | RejectedRoutedButtonInput;

export interface NoInputResult {
  kind: 'NO_INPUT';
  status: 'NO_INPUT';
  targetAttackInstanceId: string;
}

export interface InputRouteContext {
  current: AttackWindow;
  currentResolved: boolean;
  next?: AttackWindow;
  preCueBufferMs: number;
}

export type RoutedInput = RoutedButtonInput | NoInputResult;

export interface ComboDefinition {
  comboId: string;
  attacks: readonly AttackDefinition[];
  attackStartOffsetsMs: readonly number[];
  recoveryAfterMs: number;
}

export interface P0ScoreSummary {
  perfect: number;
  safe: number;
  hit: number;
  points: number;
}
