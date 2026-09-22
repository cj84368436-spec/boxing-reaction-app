import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { AppState } from 'react-native';
import type { GameClock } from '../../game/engine/GameClock';
import { P0GameScreen } from '../screens/P0GameScreen';
import { P0TenPunchSession } from '../session/P0TenPunchSession';

jest.mock('@granite-js/native/react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 20, left: 0 }),
}));

jest.mock('../components/TemporarySfxPlayer', () => {
  const { View } = require('react-native');
  return {
    TemporarySfxPlayer: ({ cue, enabled = true }: { cue?: { sound: string }; enabled?: boolean }) =>
      cue == null || !enabled ? null : <View testID={`temporary-sfx-${cue.sound}`} />,
  };
}, { virtual: true });

class ManualClock implements GameClock {
  constructor(private valueMs = 0) {}

  nowMs(): number {
    return this.valueMs;
  }

  set(valueMs: number): void {
    this.valueMs = valueMs;
  }
}

describe('P0GameScreen ten-punch playtest', () => {
  let nextFrame: ((timeMs: number) => void) | undefined;

  beforeEach(() => {
    nextFrame = undefined;
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
      nextFrame = callback;
      return 1;
    });
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function renderPlayable(debugMode = false) {
    const clock = new ManualClock(0);
    render(<P0GameScreen clock={clock} readyLeadInMs={0} seed={123} debugMode={debugMode} />);
    fireEvent.press(screen.getByRole('button', { name: '원래 속도로 도전' }));
    return {
      clock,
      sampleAt(valueMs: number) {
        clock.set(valueMs);
        act(() => nextFrame?.(valueMs));
      },
    };
  }

  function buttonHandler(label: string, event = 'onPress') {
    let button = screen.getByRole('button', {name:label});
    while (button.props[event] == null && button.parent) button = button.parent;
    return button.props[event];
  }

  it('waits for an explicit start and gives the relaxed mode a longer real input window', () => {
    const clock = new ManualClock(0);
    render(<P0GameScreen clock={clock} readyLeadInMs={0} seed={123} />);
    clock.set(5000); act(() => nextFrame?.(5000));
    expect(screen.getByText('0 / 10')).toBeTruthy();
    expect(screen.queryByRole('button', {name:'오른쪽 →'})).toBeNull();
    fireEvent.press(screen.getByRole('button', {name:'여유 있게 시작'}));
    clock.set(5600);
    fireEvent(screen.getByRole('button', {name:'오른쪽 →'}), 'pressIn');
    clock.set(5750); act(() => nextFrame?.(5750));
    expect(screen.getByText('1 / 10')).toBeTruthy();
    expect(screen.getByTestId('temporary-sfx-evade')).toBeTruthy();
  });

  it('ignores duplicate start and retry events before React commits the next screen', () => {
    const clock = new ManualClock(0);
    render(<P0GameScreen clock={clock} readyLeadInMs={0} seed={123} />);
    expect(screen.getByRole('image', {name: '얄미운 관장'})).toBeTruthy();
    expect(screen.getByText('열 번. 한 대도 안 맞으면 인정하지.')).toBeTruthy();
    const begin = buttonHandler('원래 속도로 도전');
    expect(() => act(() => { begin(); begin(); })).not.toThrow();
    clock.set(30000); act(() => nextFrame?.(30000));
    const retry = buttonHandler('다시 도전');
    expect(() => act(() => { retry(); retry(); })).not.toThrow();
    expect(screen.getByText('0 / 10')).toBeTruthy();
  });

  it('does not tick the session while paused or sitting on the completed results', () => {
    const { sampleAt } = renderPlayable();
    sampleAt(200);
    fireEvent.press(screen.getByRole('button', {name:'일시 정지'}));
    const tick = jest.spyOn(P0TenPunchSession.prototype, 'tick');
    sampleAt(30000);
    expect(tick).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', {name:'계속하기'}));
    sampleAt(60000);
    tick.mockClear(); sampleAt(61000);
    expect(tick).not.toHaveBeenCalled();
  });

  it('pauses on Android focus loss and blocks stale touch handlers immediately', () => {
    const listeners = new Map<string, (state?: string) => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event: string, listener: any) => {
      listeners.set(event, listener); return {remove: jest.fn()};
    });
    const { clock, sampleAt } = renderPlayable();
    sampleAt(200);
    const pressIn = buttonHandler('오른쪽 →', 'onPressIn');
    act(() => { listeners.get('blur')?.(); pressIn(); });
    expect(screen.getByRole('button', {name:'계속하기'})).toBeTruthy();
    sampleAt(30000);
    expect(screen.getByText('0 / 10')).toBeTruthy();
    act(() => listeners.get('focus')?.());
    fireEvent.press(screen.getByRole('button', {name:'계속하기'}));
    clock.set(30300); act(() => nextFrame?.(30300));
    expect(screen.getByTestId('temporary-sfx-hitJab')).toBeTruthy();
  });

  it('lets the player mute effects and silences playback on pause', () => {
    const {clock, sampleAt} = renderPlayable();
    clock.set(200); fireEvent(screen.getByRole('button',{name:'오른쪽 →'}), 'pressIn');
    sampleAt(480);
    expect(screen.getByTestId('temporary-sfx-evade')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', {name:'소리 끄기'}));
    expect(screen.queryByTestId('temporary-sfx-evade')).toBeNull();
    expect(screen.getByRole('button', {name:'소리 켜기'})).toBeTruthy();
    fireEvent.press(screen.getByRole('button', {name:'소리 켜기'}));
    fireEvent.press(screen.getByRole('button', {name:'일시 정지'}));
    expect(screen.queryByTestId('temporary-sfx-evade')).toBeNull();
  });

  it('pauses without resolving attacks and resumes at the same point', () => {
    const {clock, sampleAt} = renderPlayable();
    sampleAt(200);
    fireEvent.press(screen.getByRole('button', {name:'일시 정지'}));
    sampleAt(30000);
    expect(screen.getByText('0 / 10')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', {name:'계속하기'}));
    clock.set(30010); fireEvent(screen.getByRole('button', {name:'오른쪽 →'}), 'pressIn');
    sampleAt(30300);
    expect(screen.getByText('1 / 10')).toBeTruthy();
    expect(screen.getByTestId('temporary-sfx-evade')).toBeTruthy();
  });

  it('shows ten-punch progress and four controls without attack-name hints', () => {
    renderPlayable();

    expect(screen.getByText('복싱 10타 챌린지')).toBeTruthy();
    expect(screen.getByText('0 / 10')).toBeTruthy();
    expect(screen.getByRole('image', { name: '상대 복서' })).toBeTruthy();
    for (let index = 0; index < 10; index += 1) {
      expect(screen.getByTestId(`attack-progress-${index}`)).toBeTruthy();
    }
    for (const label of ['← 왼쪽', '오른쪽 →', '뒤로 피하기', '가드']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    expect(screen.queryByText('JAB')).toBeNull();
    expect(screen.queryByText('STRAIGHT')).toBeNull();
    expect(screen.queryByText('HOOK')).toBeNull();
  });

  it('moves the first-person camera, emits non-text evade feedback, and continues immediately', () => {
    const { clock, sampleAt } = renderPlayable();

    clock.set(200);
    fireEvent(screen.getByRole('button', { name: '오른쪽 →' }), 'pressIn');
    sampleAt(300);
    expect(screen.getByTestId('opponent-world').props.matrix).toEqual([1, 0, 0, 1, -64, 0]);

    sampleAt(480);
    expect(screen.getByTestId('temporary-sfx-evade')).toBeTruthy();
    expect(screen.queryByTestId('attack-feedback')).toBeNull();
    expect(screen.queryByText('PERFECT')).toBeNull();
    expect(screen.getByRole('button', { name: '← 왼쪽' })).toBeEnabled();
    expect(screen.getByText('1 / 10')).toBeTruthy();
  });

  it('shows counts and ten detailed results only after all ten outcomes finalize', () => {
    const { sampleAt } = renderPlayable();

    sampleAt(30_000);

    expect(screen.getByText('0 / 10 방어 성공')).toBeTruthy();
    expect(screen.getByRole('image', {name: '얄미운 관장'})).toBeTruthy();
    expect(screen.getByText('허, 주먹 구경하러 왔나?')).toBeTruthy();
    expect(screen.getByTestId('summary-perfect')).toHaveTextContent('완벽 회피 0');
    expect(screen.getByTestId('summary-safe')).toHaveTextContent('안전 방어 0');
    expect(screen.getByTestId('summary-hit')).toHaveTextContent('피격 10');
    for (let index = 0; index < 10; index += 1) {
      expect(screen.getByTestId(`result-${index}`)).toBeTruthy();
    }
    expect(screen.getByTestId('result-0')).toHaveTextContent(/입력 없음/);
    expect(screen.getByTestId('result-0')).toHaveTextContent(/누르지 않아 맞음/);
    expect(screen.getByTestId('result-0')).not.toHaveTextContent(/ms/);
  });

  it('the public retry after a loss preserves the pattern and clears old results', () => {
    const { clock, sampleAt } = renderPlayable(true);
    sampleAt(30_000);
    expect(screen.getByTestId('rematch-focus')).toHaveTextContent(/1번째 잽/);
    expect(screen.getByText('같은 공격 순서 · 같은 속도')).toBeTruthy();
    clock.set(31_000);
    fireEvent.press(screen.getByRole('button', {name:'다시 도전'}));
    expect(screen.getByText('SEED 123')).toBeTruthy();
    expect(screen.getByText('run-2:combo-0:attack-0')).toBeTruthy();
    expect(screen.queryByTestId('result-0')).toBeNull();
  });
  it('retry clears the prior run, while debug replay preserves its seed', () => {
    const { clock, sampleAt } = renderPlayable(true);
    sampleAt(30_000);

    clock.set(31_000);
    fireEvent.press(screen.getByRole('button', { name: 'REPLAY SEED' }));

    expect(screen.queryByText('0 / 10 방어 성공')).toBeNull();
    expect(screen.getByText('0 / 10')).toBeTruthy();
    expect(screen.getByText('SEED 123')).toBeTruthy();
    expect(screen.getByText('run-2:combo-0:attack-0')).toBeTruthy();
  });
});
