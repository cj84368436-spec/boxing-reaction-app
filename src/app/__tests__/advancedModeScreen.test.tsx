import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import type { GameClock } from '../../game/engine/GameClock';
import { P0GameScreen } from '../screens/P0GameScreen';

jest.mock('@granite-js/native/react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 20, left: 0 }),
}));

jest.mock('../components/TemporarySfxPlayer', () => ({
  TemporarySfxPlayer: () => null,
}), { virtual: true });

class FixedClock implements GameClock {
  nowMs(): number { return 0; }
}

describe('advanced-mode controls', () => {
  beforeEach(() => {
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(() => 1);
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());
  it('lets the player choose advanced mode and renders the six PRD techniques', () => {
    render(<P0GameScreen clock={new FixedClock()} readyLeadInMs={0} seed={123} />);
    fireEvent.press(screen.getByRole('button', { name: '고급 6버튼' }));
    fireEvent.press(screen.getByRole('button', { name: '원래 속도로 도전' }));

    for (const label of ['좌 슬립', '우 슬립', '좌 위빙', '우 위빙', '스웨이', '가드']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: '← 왼쪽' })).toBeNull();
  });
});
