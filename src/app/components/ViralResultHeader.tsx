import React from 'react';
import {StyleSheet,View} from 'react-native';
import {Text} from './GameText';
import type {buildViralResultPresentation} from '../product/viralResultPresentation';
type Presentation=NonNullable<ReturnType<typeof buildViralResultPresentation>>;
export function ViralResultHeader({presentation:p}:{presentation:Presentation}) {
  const cleared=p.resultCaption==='완주';
  return <View style={styles.header}>
    <Text style={styles.brand}>{p.title} · {p.difficulty}</Text>
    <Text style={[styles.headline,cleared&&styles.gold]}>{p.headline}</Text>
    <Text testID="viral-result-score" accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.score,cleared&&styles.gold]}>{p.resultText}</Text>
    <Text style={styles.caption}>{p.resultCaption} · {p.perfectText}</Text>
    <Text testID="viral-coach-line" style={styles.coach}>관장: “{p.coachLine}”</Text>
    {p.comparisonText?<View testID="recent-comparison" style={styles.comparison}>
      <Text style={styles.muted}>{p.previousLabel}{p.comparisonDelta?` · ${p.comparisonDelta}`:''}</Text>
      <Text style={styles.muted}>{p.comparisonText}</Text>
    </View>:null}
    <Text style={[styles.best,p.isPersonalBest&&styles.gold]}>{p.bestText}</Text>
    <Text style={styles.goal}>{p.goal}</Text>
  </View>;
}
const styles=StyleSheet.create({
 header:{gap:4},brand:{color:'#9DB0C1',fontSize:11,textAlign:'center'},headline:{color:'#D1DEDA',fontSize:13,textAlign:'center',fontWeight:'700'},
 score:{color:'#FFFFFF',fontSize:44,lineHeight:50,fontWeight:'900',textAlign:'center'},gold:{color:'#F3C969'},caption:{color:'#D1DEDA',fontSize:12,lineHeight:18,textAlign:'center'},
 coach:{color:'#F4E9CE',fontSize:14,lineHeight:20,paddingVertical:6},comparison:{borderLeftWidth:2,borderLeftColor:'#466B69',paddingLeft:8},muted:{color:'#B8CACA',fontSize:12,lineHeight:17},
 best:{color:'#B8CACA',fontSize:12,lineHeight:17},goal:{color:'#F3C969',fontSize:13,lineHeight:19,fontWeight:'700'},
});
