import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './GameText';
import { controlsForLevel, type DefenseControlInput } from '../session/advancedDefense';

const LABELS: Record<DefenseControlInput, string> = {LEFT:'← 왼쪽',RIGHT:'오른쪽 →',BACK:'뒤로 피하기',GUARD:'가드',DUCK:'숙이기',STEP_IN:'앞으로 파고들기'};

interface DefenseControlsProps {
  readonly disabled?: boolean;
  readonly compact?: boolean;
  readonly level?: 1 | 2 | 3;
  readonly onDefensePressIn?: (input: DefenseControlInput) => void;
  readonly onDefensePressOut?: (input: DefenseControlInput) => void;
}

export function DefenseControls({
  disabled = false,
  compact = false,
  level = 1,
  onDefensePressIn,
  onDefensePressOut,
}: DefenseControlsProps) {
  const [activeButton, setActiveButton] = useState<DefenseControlInput | null>(null);
  useEffect(() => { if (disabled) setActiveButton(null); }, [disabled]);
  const buttons = controlsForLevel(level);

  return (
    <View accessibilityLabel="방어 버튼" style={styles.grid}>
      {Array.from({length: Math.ceil(buttons.length / 2)}, (_, rowIndex) => buttons.slice(rowIndex * 2, rowIndex * 2 + 2)).map((row, rowIndex) => <View key={rowIndex} style={styles.row}>
      {row.map((button) => {
        const selected = activeButton === button;
        return (
          <Pressable
            key={button}
            accessibilityLabel={LABELS[button]}
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
            style={[styles.button, (button === "BACK" || button === "GUARD") && styles.blueButton, (button === 'DUCK' || button === 'STEP_IN') && styles.advancedButton, compact && styles.buttonCompact, selected && styles.buttonPressed, disabled && styles.buttonDisabled]}
          >
            <Text style={[styles.buttonLabel, selected && styles.buttonLabelPressed]}>
              {LABELS[button]}
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
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#111A20',
    backgroundColor: '#B83930',
    shadowColor: '#02070B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  blueButton: { backgroundColor: "#285CA1" },
  advancedButton: { backgroundColor: '#795332', minHeight: 52 },
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
