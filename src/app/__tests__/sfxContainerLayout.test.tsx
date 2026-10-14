import React from 'react';
import {render} from '@testing-library/react-native';
import {StyleSheet, View} from 'react-native';
import {TemporarySfxPlayer} from '../components/TemporarySfxPlayer';

// Keep the installed iOS wrapper; replacing the whole WebView hid its flex:1.
jest.mock('react-native-webview/src/NativeRNCWebViewModule', () => ({
  __esModule:true, default:{shouldStartLoadWithLockIdentifier:jest.fn()},
}));
jest.mock('react-native-webview/src/RNCWebViewNativeComponent', () => ({
  __esModule:true, default:require('react-native').View, Commands:{},
}));
jest.mock('@granite-js/native/react-native-webview', () => ({
  WebView:jest.requireActual('react-native-webview/src/WebView.ios').default,
}));

it('keeps the real audio wrapper outside the game layout before and after mute', () => {
  const view = render(<TemporarySfxPlayer/>);
  function expectNoLayoutSlot() {
    const outer = StyleSheet.flatten(view.UNSAFE_getAllByType(View)[0]!.props.style);
    expect(outer).toMatchObject({position:'absolute',width:1,height:1,flex:0});
  }
  expectNoLayoutSlot();
  view.rerender(<TemporarySfxPlayer enabled={false}/>);
  expect(view.toJSON()).toBeNull();
  view.rerender(<TemporarySfxPlayer/>);
  expectNoLayoutSlot();
});
