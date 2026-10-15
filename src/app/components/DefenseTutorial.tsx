import React, {useEffect, useRef, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Text} from './GameText';
import {DefenseControls} from './DefenseControls';
import type {DefenseControlInput} from '../session/advancedDefense';

// UI practice only: no session, clock, storage or advertising dependencies.
const FEEDBACK_MS = 2000;
export function DefenseTutorial({active, onComplete}: {active:boolean; onComplete:()=>void}) {
  const [step,setStep]=useState(0);
  const [accepted,setAccepted]=useState(false);
  const [hint,setHint]=useState('');
  const acceptedRef=useRef(false);
  const doneRef=useRef(false);
  const completeRef=useRef(onComplete);completeRef.current=onComplete;
  useEffect(()=>{
    if(!active||!accepted)return;
    const timer=setTimeout(()=>{
      if(step===0){acceptedRef.current=false;setAccepted(false);setHint('');setStep(1);}
      else if(!doneRef.current){doneRef.current=true;completeRef.current();}
    },FEEDBACK_MS);
    return ()=>clearTimeout(timer);
  },[active,accepted,step]);
  const press=(input:DefenseControlInput)=>{
    if(!active||acceptedRef.current)return;
    if(input!==(step===0?'LEFT':'GUARD')){setHint(step===0?'왼쪽 버튼을 눌러보세요':'가드 버튼을 눌러보세요');return;}
    acceptedRef.current=true;setAccepted(true);setHint('');
  };
  return <View testID="defense-tutorial" style={styles.card} accessibilityViewIsModal>
    <ScrollView contentContainerStyle={styles.copy}>
      <Text accessibilityRole="header" style={styles.title}>몸풀기 · {step+1} / 2</Text>
      <Text style={styles.body}>{step===0?'잽이 오면 왼쪽으로 회피':'이번에는 정면 공격 · 가드'}</Text>
      <Text style={styles.symbol} accessible={false}>{step===0?'←':'🛡'}</Text>
      <Text accessibilityLiveRegion="polite" style={styles.body}>{!active?'돌아오면 연습을 이어갑니다':accepted?step===0?'좋아. 왼쪽 회피!':'준비 완료 · 곧 시작합니다':hint||'아래 방어 버튼을 눌러보세요'}</Text>
      <Text style={styles.note}>연습에서는 목숨이 줄지 않아요. 기록에도 남지 않아요.</Text>
    </ScrollView>
    <DefenseControls compact disabled={!active||accepted} onDefensePressIn={press}/>
  </View>;
}
const styles=StyleSheet.create({
 card:{...StyleSheet.absoluteFillObject,backgroundColor:'#14262A',padding:16,gap:12,zIndex:5},
 copy:{gap:12,flexGrow:1,justifyContent:'center'},
 title:{fontSize:22,fontWeight:'800',color:'#F8DFAB'},
 body:{fontSize:18,color:'#FFFFFF'},symbol:{fontSize:52,color:'#F8DFAB',textAlign:'center'},
 note:{fontSize:13,color:'#CAD8D8'},
});
