import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

function Failure({ stage, error }: { stage: string; error: unknown }) {
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  return <ScrollView style={{ flex: 1, backgroundColor: '#10262B' }} contentContainerStyle={{ padding: 28, paddingTop: 90 }}>
    <Text style={{ color: '#FFCE70', fontSize: 24 }}>{stage}</Text>
    <Text style={{ color: '#FFFFFF', marginTop: 20 }}>진단 버전 B · 이 화면을 캡처해 주세요.</Text>
    <Text selectable style={{ color: '#FFFFFF', marginTop: 20 }}>{detail.slice(0, 2500)}</Text>
  </ScrollView>;
}

class GameErrorBoundary extends React.Component<React.PropsWithChildren, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    return this.state.error ? <Failure stage="게임 화면 실행 실패" error={this.state.error} /> : this.props.children;
  }
}

// Keep this module free of game, audio, SVG, storage and ad imports.
// A visible entry screen separates host/bootstrap failures from game loading.
export function DiagnosticEntry({ loadGame }: { loadGame: () => React.ComponentType }) {
  const [Game, setGame] = useState<React.ComponentType | null>(null);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  if (failure) return <Failure stage="게임 모듈 로딩 실패" error={failure.error} />;
  if (Game) return <GameErrorBoundary><Game /></GameErrorBoundary>;
  return <View style={{ flex: 1, backgroundColor: '#10262B', padding: 28, paddingTop: 100 }}>
    <Text style={{ color: '#FFCE70', fontSize: 28 }}>앱 진입 성공</Text>
    <Text style={{ color: '#FFFFFF', marginTop: 20 }}>진단 버전 B · 아직 게임을 불러오지 않았습니다.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="게임 불러오기"
      style={{ backgroundColor: '#E5B950', padding: 20, marginTop: 32 }}
      onPress={() => {
        try {
          const LoadedGame = loadGame();
          setGame(() => LoadedGame);
        } catch (error) { setFailure({ error }); }
      }}>
      <Text style={{ color: '#10262B', fontSize: 20 }}>게임 불러오기</Text>
    </Pressable>
  </View>;
}
