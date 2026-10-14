import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { DiagnosticEntry } from '../screens/DiagnosticEntry';

describe('diagnostic startup isolation', () => {
  it('does not initialize the game before the user requests it', () => {
    let calls = 0;
    render(<DiagnosticEntry loadGame={() => {
      calls += 1;
      return () => <Text>게임 실행 확인</Text>;
    }} />);
    expect(screen.getByText('앱 진입 성공')).toBeTruthy();
    expect(calls).toBe(0);
    fireEvent.press(screen.getByRole('button', { name: '게임 불러오기' }));
    expect(screen.getByText('게임 실행 확인')).toBeTruthy();
    expect(calls).toBe(1);
  });

  it('shows a module initialization error instead of losing the diagnostic screen', () => {
    render(<DiagnosticEntry loadGame={() => { throw new Error('module initialization failed'); }} />);
    fireEvent.press(screen.getByRole('button', { name: '게임 불러오기' }));
    expect(screen.getByText('게임 모듈 로딩 실패')).toBeTruthy();
    expect(screen.getByText(/module initialization failed/)).toBeTruthy();
  });

  it('shows a game render error with its stage', () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<DiagnosticEntry loadGame={() => function BrokenGame() {
        throw new Error('game render failed');
      }} />);
      fireEvent.press(screen.getByRole('button', { name: '게임 불러오기' }));
      expect(screen.getByText('게임 화면 실행 실패')).toBeTruthy();
      expect(screen.getByText(/game render failed/)).toBeTruthy();
    } finally { errorLog.mockRestore(); }
  });
});
