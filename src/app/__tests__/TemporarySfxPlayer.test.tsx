import React from 'react';
import {act, render, screen} from '@testing-library/react-native';
import {TemporarySfxPlayer} from '../components/TemporarySfxPlayer';
const mockInject = jest.fn();
jest.mock('@granite-js/native/react-native-webview', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {WebView: React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({injectJavaScript: (...args: any[]) => mockInject(...args)}));
    return <View {...props}/>;
  })};
});
beforeEach(() => mockInject.mockClear());
function ready() {act(() => screen.getByTestId('sfx-web-player', {includeHiddenElements:true}).props.onMessage({nativeEvent:{data:'{"type":"ready"}'}}));}
it('uses inline HTML audio for embedded WAV instead of a native file URL', () => {
  render(<TemporarySfxPlayer/>);
  const player = screen.getByTestId('sfx-web-player', {includeHiddenElements:true});
  expect(player.props.mediaPlaybackRequiresUserAction).toBe(false);
  expect(player.props.allowsInlineMediaPlayback).toBe(true);
  expect(player.props.source.html).toContain('data:audio/wav;base64,');
  expect(player.props.source.html).toContain('new Audio(');
  expect(player.props.source.html).toContain('visibilitychange');
});
it('plays a new impact once, stops on mute, and never replays an interrupted cue', () => {
  const cue = {id:'run-1:1',sound:'hit'} as const;
  const {rerender} = render(<TemporarySfxPlayer/>); ready();
  rerender(<TemporarySfxPlayer cue={cue}/>);
  expect(mockInject).toHaveBeenLastCalledWith(expect.stringContaining('"run-1:1","hit"'));
  const count = mockInject.mock.calls.length;
  rerender(<TemporarySfxPlayer cue={cue}/>); expect(mockInject).toHaveBeenCalledTimes(count);
  rerender(<TemporarySfxPlayer cue={cue} enabled={false}/>);
  expect(screen.queryByTestId('sfx-web-player', {includeHiddenElements:true})).toBeNull();
  rerender(<TemporarySfxPlayer cue={cue}/>); ready();
  expect(mockInject.mock.calls.filter(([script]) => script.includes('"run-1:1","hit"'))).toHaveLength(1);
  rerender(<TemporarySfxPlayer cue={{id:'run-1:2',sound:'knockout'}}/>);
  expect(mockInject).toHaveBeenLastCalledWith(expect.stringContaining('"run-1:2","knockout"'));
});
it('does not replay a stale impact after the audio bridge becomes ready', () => {
  render(<TemporarySfxPlayer cue={{id:'old',sound:'guard'}}/>); ready();
  expect(mockInject.mock.calls.some(([script]) => script.includes('"old","guard"'))).toBe(false);
});
it('reports a rejected playback without crashing the game', () => {
  const onPlaybackError = jest.fn();
  render(<TemporarySfxPlayer onPlaybackError={onPlaybackError}/>);
  act(() => screen.getByTestId('sfx-web-player', {includeHiddenElements:true}).props.onMessage({nativeEvent:{data:'{"type":"error"}'}}));
  expect(onPlaybackError).toHaveBeenCalledTimes(1);
});



