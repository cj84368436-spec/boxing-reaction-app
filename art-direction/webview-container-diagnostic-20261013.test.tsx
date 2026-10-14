import React from 'react';
import {render} from '@testing-library/react-native';
import {StyleSheet, View} from 'react-native';

// Only replace native endpoints. Keep the installed iOS WebView's actual
// JavaScript wrapper, which the production sound-player tests replaced.
jest.mock('react-native-webview/src/NativeRNCWebViewModule', () => ({
  __esModule:true, default:{shouldStartLoadWithLockIdentifier:jest.fn()},
}));
jest.mock('react-native-webview/src/RNCWebViewNativeComponent', () => ({
  __esModule:true, default:require('react-native').View, Commands:{},
}));
const ActualIOSWebView = jest.requireActual('react-native-webview/src/WebView.ios').default;

it('reproduces the invisible flex container despite a one-pixel absolute inner view', () => {
  const {UNSAFE_getAllByType} = render(<ActualIOSWebView source={{html:'<html></html>'}}
    style={{position:'absolute',width:1,height:1,opacity:.01}}/>);
  const views = UNSAFE_getAllByType(View);
  const outer = StyleSheet.flatten(views[0]!.props.style);
  const inner = StyleSheet.flatten(views[1]!.props.style);
  expect(outer).toEqual({flex:1,overflow:'hidden'});
  expect(outer.position).toBeUndefined();
  expect(outer.height).toBeUndefined();
  expect(inner).toMatchObject({position:'absolute',width:1,height:1});
});

it('shows that isolating the outer container removes that flex slot', () => {
  const {UNSAFE_getAllByType} = render(<ActualIOSWebView source={{html:'<html></html>'}}
    containerStyle={{position:'absolute',width:1,height:1,flex:0,opacity:.01}}
    style={{width:1,height:1,flex:0}}/>);
  const outer = StyleSheet.flatten(UNSAFE_getAllByType(View)[0]!.props.style);
  expect(outer).toMatchObject({position:'absolute',width:1,height:1,flex:0});
});
