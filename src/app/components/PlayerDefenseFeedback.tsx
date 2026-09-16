import React from 'react';
import { G } from 'react-native-svg';
import { buildPlayerGloves } from '../motion/boxingArtwork';
import { VectorArtwork } from './VectorArtwork';

export function PlayerDefenseFeedback({ guard }: { readonly guard: number }) {
  return (
    <G testID="player-gloves">
      <VectorArtwork nodes={buildPlayerGloves(guard)} />
    </G>
  );
}
