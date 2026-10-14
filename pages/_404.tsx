import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

export default function NotFoundPage() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>페이지를 찾을 수 없어요</Text>
      <Text style={styles.description}>게임을 닫고 다시 열어 주세요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#111827',
  },
  title: {color: '#FFFFFF', fontSize: 20, fontWeight: '700', textAlign: 'center'},
  description: {color: '#D1D5DB', fontSize: 16, marginTop: 12, textAlign: 'center'},
});
