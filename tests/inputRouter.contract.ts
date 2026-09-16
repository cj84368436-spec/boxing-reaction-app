import { detectMultiInput, routeInput } from '../src/game/engine/InputRouter.js';
import type {
  DefenseInput,
  NoInputResult,
  RoutedButtonInput,
  RoutedInput
} from '../src/game/model/types.js';

const attack = {
  attackInstanceId: 'jab-instance-a',
  cueAtMs: 1000,
  responseStartAtMs: 1000,
  responseEndAtMs: 1360,
  impactAtMs: 1480
};

const routedButton: RoutedButtonInput = routeInput(
  { atMs: 1200, input: 'LEFT' },
  { current: attack, currentResolved: false, preCueBufferMs: 100 }
);
const timestamp: number = routedButton.atMs;
const button: DefenseInput = routedButton.input;

detectMultiInput(routedButton, routedButton, 35);

const noInput: NoInputResult = {
  kind: 'NO_INPUT',
  status: 'NO_INPUT',
  targetAttackInstanceId: 'jab-instance-a'
};
const routedResult: RoutedInput = noInput;

// @ts-expect-error NO_INPUT is not a routed button and cannot enter MULTI_INPUT detection.
detectMultiInput(noInput, routedButton, 35);
// @ts-expect-error A system NO_INPUT result must never carry a fake defense button.
noInput.input;

void timestamp;
void button;
void routedResult;
