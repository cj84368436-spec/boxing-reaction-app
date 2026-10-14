import {WebView} from '@granite-js/native/react-native-webview';
import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet} from 'react-native';
import {SFX_HTML_SOURCE} from '../assets/sfx/sfxPlayerHtml';

export type PlaytestSound = 'evade' | 'guard' | 'hit' | 'hitJab' | 'hitStraight' | 'hitHook' | 'recognition' | 'knockout';
export interface PlaytestSoundCue {
  readonly id: string;
  readonly sound: PlaytestSound;
}

// Granite's iOS video provider treats non-HTTP sources as file paths, which
// cannot play the embedded data: WAVs. HTML audio supports those original bytes.
export function TemporarySfxPlayer({cue, enabled = true, onPlaybackError, onPlaybackSuccess}: {
  readonly cue?: PlaytestSoundCue;
  readonly enabled?: boolean;
  readonly onPlaybackError?: () => void;
  readonly onPlaybackSuccess?: () => void;
}) {
  const web = useRef<WebView>(null);
  const consumed = useRef<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) {
      consumed.current = cue?.id;
      setReady(false);
      return;
    }
    if (cue == null) {
      consumed.current = undefined;
      if (ready) web.current?.injectJavaScript('window.stopBoxingSound(); true;');
    } else if (cue.id !== consumed.current) {
      // Do not replay a stale impact when loading finishes or sound is enabled.
      consumed.current = cue.id;
      if (ready) web.current?.injectJavaScript(
        'window.playBoxingSound(' + JSON.stringify(cue.id) + ',' + JSON.stringify(cue.sound) + '); true;');
    }
  }, [cue?.id, cue?.sound, enabled, ready]);
  if (!enabled) return null;
  return <WebView ref={web} testID="sfx-web-player" source={SFX_HTML_SOURCE}
    mediaPlaybackRequiresUserAction={false} allowsInlineMediaPlayback
    allowsPictureInPictureMediaPlayback={false} allowsAirPlayForMediaPlayback={false}
    javaScriptEnabled scrollEnabled={false} originWhitelist={['*']}
    accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    onShouldStartLoadWithRequest={({url}) => url === 'about:blank' || url.startsWith('data:text/html')}
    onLoadStart={() => setReady(false)}
    onMessage={({nativeEvent}) => {
      try {
        const message = JSON.parse(nativeEvent.data) as {type: string; id?: string};
        if (message.type === 'ready') setReady(true);
        else if (message.id == null || message.id === cue?.id) {
          if (message.type === 'error') onPlaybackError?.();
          if (message.type === 'playing') onPlaybackSuccess?.();
        }
      } catch { /* Ignore unrelated or malformed bridge messages. */ }
    }}
    onError={() => {setReady(false); onPlaybackError?.();}}
    onContentProcessDidTerminate={() => {setReady(false); onPlaybackError?.(); web.current?.reload();}}
    onRenderProcessGone={() => {setReady(false); onPlaybackError?.(); web.current?.reload();}}
    containerStyle={styles.hiddenContainer} style={styles.hidden}/>;
}
const styles = StyleSheet.create({
  // WebView adds its own flex:1 View. Hide that outer View as well as the
  // native player, otherwise sound preparation consumes half the arena.
  hiddenContainer: {position: 'absolute', top: 0, left: 0, width: 1, height: 1, flex: 0, opacity: 0.01},
  hidden: {width: 1, height: 1, flex: 0},
});

