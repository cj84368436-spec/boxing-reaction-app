import type {
  DefenseInputEvent,
  InputRouteContext,
  RoutedButtonInput
} from '../model/types.js';

export function detectMultiInput(
  previous: RoutedButtonInput,
  current: RoutedButtonInput,
  simultaneousInputMs: number
): boolean {
  if (
    previous.status !== 'VALID' ||
    current.status !== 'VALID' ||
    previous.targetAttackInstanceId !== current.targetAttackInstanceId
  ) {
    return false;
  }

  return previous.input !== current.input && Math.abs(current.atMs - previous.atMs) <= simultaneousInputMs;
}

export function routeInput(
  event: DefenseInputEvent,
  context: InputRouteContext
): RoutedButtonInput {
  const { current, currentResolved, next, preCueBufferMs } = context;

  if (!currentResolved) {
    if (event.atMs < current.responseStartAtMs) {
      return { kind: 'BUTTON', ...event, status: 'EARLY', buffered: false };
    }
    if (event.atMs <= current.responseEndAtMs) {
      return {
        kind: 'BUTTON',
        ...event,
        status: 'VALID',
        targetAttackInstanceId: current.attackInstanceId,
        buffered: false
      };
    }

    if (next && event.atMs >= next.cueAtMs - preCueBufferMs && event.atMs <= next.responseEndAtMs) {
      return {
        kind: 'BUTTON',
        ...event,
        status: 'VALID',
        targetAttackInstanceId: next.attackInstanceId,
        buffered: event.atMs < next.responseStartAtMs
      };
    }

    return { kind: 'BUTTON', ...event, status: 'LATE', buffered: false };
  }

  if (next) {
    const bufferStart = next.cueAtMs - preCueBufferMs;
    if (event.atMs < bufferStart) {
      return { kind: 'BUTTON', ...event, status: 'EARLY', buffered: false };
    }
    if (event.atMs <= next.responseEndAtMs) {
      return {
        kind: 'BUTTON',
        ...event,
        status: 'VALID',
        targetAttackInstanceId: next.attackInstanceId,
        buffered: event.atMs < next.responseStartAtMs
      };
    }
    return { kind: 'BUTTON', ...event, status: 'LATE', buffered: false };
  }

  return { kind: 'BUTTON', ...event, status: 'LATE', buffered: false };
}
