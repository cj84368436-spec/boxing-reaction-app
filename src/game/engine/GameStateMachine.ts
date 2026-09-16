export type GameState =
  | 'READY'
  | 'COUNTDOWN'
  | 'ATTACK_PREP'
  | 'RESPONSE_WINDOW'
  | 'RESOLVE'
  | 'RECOVERY'
  | 'COMBO_BUFFER'
  | 'FINISHED';

const TRANSITIONS: Readonly<Record<GameState, readonly GameState[]>> = {
  READY: ['COUNTDOWN'],
  COUNTDOWN: ['ATTACK_PREP'],
  ATTACK_PREP: ['RESPONSE_WINDOW'],
  RESPONSE_WINDOW: ['RESOLVE'],
  RESOLVE: ['RECOVERY', 'COMBO_BUFFER', 'FINISHED'],
  RECOVERY: ['ATTACK_PREP', 'FINISHED'],
  COMBO_BUFFER: ['ATTACK_PREP', 'FINISHED'],
  FINISHED: []
};

export function canTransition(from: GameState, to: GameState): boolean {
  return TRANSITIONS[from].includes(to);
}

export class GameStateMachine {
  private state: GameState = 'READY';

  get current(): GameState {
    return this.state;
  }

  transition(to: GameState): GameState {
    if (!canTransition(this.state, to)) {
      throw new Error(`Invalid game state transition: ${this.state} -> ${to}`);
    }
    this.state = to;
    return this.state;
  }
}
