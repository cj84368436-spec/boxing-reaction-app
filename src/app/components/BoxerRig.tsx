import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Line, Polyline } from 'react-native-svg';
import { buildBoxerArtwork } from '../motion/boxingArtwork';
import { VectorArtwork } from './VectorArtwork';
import { sampleLeadJabReadyPose } from '../motion/leadJabReadyPose';
import { COMBAT_VIEW, projectCombatPose, type getFirstPersonFrame } from '../motion/firstPersonPresentation';
import { getP0MotionAsset } from '../motion/p0MotionRegistry';
import { PlayerDefenseFeedback } from './PlayerDefenseFeedback';
import type { SampledPose } from '../motion/types';

interface BoxerRigProps {
  readonly pose?: SampledPose;
  readonly frame?: ReturnType<typeof getFirstPersonFrame>;
}

export function BoxerRig({ pose, frame }: BoxerRigProps) {
  const artwork = useMemo(() => {
    if (frame) return buildBoxerArtwork(frame.pose, frame.cueActive ? frame.hand : undefined);
    const sampled = pose ?? sampleLeadJabReadyPose();
    return buildBoxerArtwork(projectCombatPose(getP0MotionAsset(sampled.attackId), sampled.timeMs));
  }, [pose, frame]);

  return (
    <View
      accessibilityLabel="상대 복서"
      accessibilityRole="image"
      accessible
      pointerEvents="none"
      style={styles.viewport}
    >
      <Svg
        testID="boxer-rig-svg"
        width="100%"
        height="100%"
        viewBox={`0 0 ${COMBAT_VIEW.width} ${COMBAT_VIEW.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <G testID="opponent-world" transform={`translate(${frame?.cameraX ?? 0} ${frame?.cameraY ?? 0}) translate(140 165) scale(${frame?.cameraScale ?? 1}) translate(-140 -165)`}>
        {frame?.cueActive ? <Polyline points={[...frame.trail, frame.pose[frame.hand]].map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#F3C969" strokeWidth={18} strokeLinecap="round" opacity={0.22} /> : null}
        <VectorArtwork nodes={artwork} />
        </G>
        {frame?.contact && (frame.hit || frame.guard > .5) ? <G>{Array.from({length:8}, (_, i) => {
          const a = i * Math.PI / 4, x = 140 + frame.cameraX, y = 165 + frame.cameraY;
          return <Line key={i} x1={x+Math.cos(a)*43} y1={y+Math.sin(a)*43} x2={x+Math.cos(a)*54} y2={y+Math.sin(a)*54} stroke={frame.hit ? '#FF7A80' : '#F3C969'} strokeWidth={3} strokeLinecap="round" />;
        })}</G> : null}
        <PlayerDefenseFeedback guard={frame?.guard ?? 0} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
});
