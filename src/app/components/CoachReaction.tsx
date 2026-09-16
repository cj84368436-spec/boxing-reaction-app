import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import { buildCoachArtwork, type CoachMood } from '../motion/boxingArtwork';
import { VectorArtwork } from './VectorArtwork';

export function CoachReaction({ reaction, compact = false }: { readonly compact?: boolean; readonly reaction: { readonly mood: CoachMood; readonly line: string; readonly note: string } }) {
  return <View style={[styles.card, compact && styles.compactCard]} testID={compact ? "coach-ringside" : "coach-reaction"}>
    <View accessible accessibilityRole="image" accessibilityLabel="얄미운 관장" style={[styles.portrait, compact && styles.compactPortrait]}>
      <Svg width={compact ? 64 : 104} height={compact ? 72 : 128} viewBox="0 0 136 160"><VectorArtwork nodes={buildCoachArtwork(reaction.mood)} /></Svg>
    </View>
    <View style={styles.copy}>
      <Text style={styles.label}>동네 체육관 · 관장</Text>
      <Text testID={compact ? "coach-live-line" : undefined} style={[styles.line, compact && styles.compactLine]}>{reaction.line}</Text>
      {!compact ? <Text style={styles.note}>{reaction.note}</Text> : null}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  compactCard: { paddingVertical: 0, borderBottomWidth: 0, backgroundColor: "#162C2D", borderRadius: 12, paddingRight: 10 },
  compactPortrait: { width: 64, height: 72, borderRadius: 12 },
  compactLine: { fontSize: 13, lineHeight: 18 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#43504D' },
  portrait: { width: 104, height: 128, flexShrink: 0, backgroundColor: '#233C3C', borderRadius: 14, overflow: 'hidden' },
  copy: { flex: 1, gap: 7 },
  label: { color: '#CAB78C', fontSize: 10, fontWeight: '700' },
  line: { color: '#F4E5C7', fontSize: 18, lineHeight: 25, fontWeight: '800' },
  note: { color: '#AEBFBD', fontSize: 12, lineHeight: 18 },
});
