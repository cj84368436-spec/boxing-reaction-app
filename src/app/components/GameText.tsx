import React from 'react';
import {Text as NativeText, type TextProps} from 'react-native';

/** Keep Korean words together while retaining the user's text-size setting. */
export function Text(props: TextProps) {
  return <NativeText lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality"
    android_hyphenationFrequency="none" {...props}/>;
}
