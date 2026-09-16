import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DefenseInput } from '../../game/model/types';

const DEFENSE_BUTTONS = ['LEFT', 'RIGHT', 'BACK', 'GUARD'] as const;

interface DefenseControlsProps {
  readonly disabled?: boolean;
  readonly compact?: boolean;
  readonly onDefensePressIn?: (input: DefenseInput) => void;
  readonly onDefensePressOut?: (input: DefenseInput) => void;
}

export function DefenseControls({
  disabled = false,
  compact = false,
  onDefensePressIn,
  onDefensePressOut,
}: DefenseControlsProps) {
  const [activeButton, setActiveButton] = useState<DefenseInput | null>(null);
  useEffect(() => { if (disabled) setActiveButton(null); }, [disabled]);

  return (
    <View accessibilityLabel="방어 버튼" style={styles.grid}>
      {[DEFENSE_BUTTONS.slice(0, 2), DEFENSE_BUTTONS.slice(2)].map((row, rowIndex) => <View key={rowIndex} style={styles.row}>
      {row.map((button) => {
        const selected = activeButton === button;
        return (
          <Pressable
            key={{LEFT: '← 왼쪽', RIGHT: '오른쪽 →', BACK: '뒤로 피하기', GUARD: '가드'}[button]}
            accessibilityLabel={{LEFT: '← 왼쪽', RIGHT: '오른쪽 →', BACK: '뒤로 피하기', GUARD: '가드'}[button]}
            accessibilityRole="button"
            accessibilityState={{ disabled, selected }}
            disabled={disabled}
            onPressIn={() => {
              setActiveButton(button);
              onDefensePressIn?.(button);
            }}
            onPressOut={() => {
              setActiveButton(null);
              onDefensePressOut?.(button);
            }}
            style={[styles.button, compact && styles.buttonCompact, selected && styles.buttonPressed, disabled && styles.buttonDisabled]}
          >
            <Text style={[styles.buttonLabel, selected && styles.buttonLabelPressed]}>
              {{LEFT: '← 왼쪽', RIGHT: '오른쪽 →', BACK: '뒤로 피하기', GUARD: '가드'}[button]}
            </Text>
          </Pressable>
        );
      })}
      </View>)}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 8,
  },
  row: { flexDirection: 'row', gap: 8 },
  buttonCompact: { minHeight: 52 },
  button: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#52677A',
    backgroundColor: '#172A3A',
    shadowColor: '#02070B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonPressed: {
    borderColor: '#FF7A80',
    backgroundColor: '#B92E36',
    transform: [{ scale: 0.97 }],
  },
  buttonDisabled: {
    opacity: 0.52,
  },
  buttonLabel: {
    color: '#F7FAFC',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
  },
  buttonLabelPressed: {
    color: '#FFFFFF',
  },
});
