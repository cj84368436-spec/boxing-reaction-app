import { Video } from '@granite-js/video';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { PLAYTEST_SFX_DATA_URIS } from '../assets/sfx/playtestSfxData';

export type PlaytestSound = 'evade' | 'guard' | 'hit' | 'hitJab' | 'hitStraight' | 'hitHook' | 'recognition';

export interface PlaytestSoundCue {
  readonly id: string;
  readonly sound: PlaytestSound;
}

const SOURCES: Readonly<Record<PlaytestSound, { readonly uri: string; readonly type: string }>> = {
  hitJab: {uri:PLAYTEST_SFX_DATA_URIS.hitJab,type:'wav'},
  hitStraight: {uri:PLAYTEST_SFX_DATA_URIS.hitStraight,type:'wav'},
  hitHook: {uri:PLAYTEST_SFX_DATA_URIS.hitHook,type:'wav'},
  recognition: {uri:PLAYTEST_SFX_DATA_URIS.recognition,type:'wav'},
  evade: { uri: PLAYTEST_SFX_DATA_URIS.evade, type: 'wav' },
  guard: { uri: PLAYTEST_SFX_DATA_URIS.guard, type: 'wav' },
  hit: { uri: PLAYTEST_SFX_DATA_URIS.hit, type: 'wav' },
};

export function TemporarySfxPlayer({ cue, enabled = true }: { readonly cue?: PlaytestSoundCue; readonly enabled?: boolean }) {
  const consumed = useRef<string | undefined>(undefined);
  const [playing, setPlaying] = useState<PlaytestSoundCue>();
  useEffect(() => {
    if (!enabled || cue == null) {
      consumed.current = cue?.id;
      setPlaying(undefined);
    } else if (cue.id !== consumed.current) {
      consumed.current = cue.id;
      setPlaying(cue);
    }
  }, [cue?.id, cue?.sound, enabled]);
  if (!enabled || playing == null) return null;

  return (
    <Video
      key={playing.id}
      testID={`temporary-sfx-${playing.sound}`}
      source={SOURCES[playing.sound]}
      paused={false}
      controls={false}
      volume={0.7}
      ignoreSilentSwitch="obey"
      playInBackground={false}
      playWhenInactive={false}
      onEnd={() => setPlaying(current => current?.id === playing.id ? undefined : current)}
      onError={() => setPlaying(current => current?.id === playing.id ? undefined : current)}
      style={styles.hidden}
    />
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
