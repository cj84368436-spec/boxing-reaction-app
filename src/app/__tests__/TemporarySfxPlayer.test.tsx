import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { TemporarySfxPlayer } from '../components/TemporarySfxPlayer';

jest.mock('@granite-js/video', () => {
  const { View } = require('react-native');
  return { Video: (props: any) => <View {...props} /> };
});

it('drops an interrupted sound and waits for a new result after resume or unmute', () => {
  const cue = {id:'run-1:1', sound:'hit'} as const;
  const {rerender} = render(<TemporarySfxPlayer cue={cue} />);
  const player = screen.getByTestId('temporary-sfx-hit');
  expect(player.props.playInBackground).toBe(false);
  expect(player.props.playWhenInactive).toBe(false);
  expect(player.props.ignoreSilentSwitch).toBe('obey');
  rerender(<TemporarySfxPlayer cue={cue} enabled={false} />);
  expect(screen.queryByTestId('temporary-sfx-hit')).toBeNull();
  rerender(<TemporarySfxPlayer cue={cue} enabled />);
  expect(screen.queryByTestId('temporary-sfx-hit')).toBeNull();
  rerender(<TemporarySfxPlayer cue={{id:'run-1:2', sound:'guard'}} />);
  expect(screen.getByTestId('temporary-sfx-guard')).toBeTruthy();
  act(() => screen.getByTestId('temporary-sfx-guard').props.onEnd());
  expect(screen.queryByTestId('temporary-sfx-guard')).toBeNull();
});

it('a failed audio decoder does not keep a broken player mounted', () => {
  render(<TemporarySfxPlayer cue={{id:'run-1:1', sound:'evade'}} />);
  act(() => screen.getByTestId('temporary-sfx-evade').props.onError());
  expect(screen.queryByTestId('temporary-sfx-evade')).toBeNull();
});

it('ignores a stale completion callback after the next impact has started', () => {
  const {rerender} = render(<TemporarySfxPlayer cue={{id:'old',sound:'hit'}} />);
  const oldEnd = screen.getByTestId('temporary-sfx-hit').props.onEnd;
  rerender(<TemporarySfxPlayer cue={{id:'next',sound:'guard'}} />);
  act(() => oldEnd());
  expect(screen.getByTestId('temporary-sfx-guard')).toBeTruthy();
});
