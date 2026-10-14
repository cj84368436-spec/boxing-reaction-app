import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './GameText';
import { Svg } from 'react-native-svg';
import type { CoachMood } from '../motion/boxingArtwork';
import { SpriteImage } from './SpriteImage';
import { ART_ATLAS } from '../motion/artAtlas';
import { ART_SOURCES } from '../assets/artSources';
const coach=ART_SOURCES.coach;
export function CoachReaction({reaction,compact=false}:{readonly compact?:boolean;readonly reaction:{readonly mood:CoachMood;readonly line:string;readonly note:string}}) {
 const index={smirk:0,interested:1,surprised:2}[reaction.mood];
 return <View style={[styles.card,compact&&styles.compactCard]} testID={compact?'coach-ringside':'coach-reaction'}>
  <View accessible accessibilityRole="image" accessibilityLabel="얄미운 관장" style={[styles.portrait,compact&&styles.compactPortrait]}>
   <Svg width="100%" height="100%" viewBox={compact?"0 0 100 80":"0 0 100 125"} preserveAspectRatio="xMidYMin slice"><SpriteImage source={coach} {...ART_ATLAS.coach} index={index} displayWidth={100} displayHeight={125}/></Svg>
  </View>
  <View style={styles.copy}><Text style={styles.label}>동네 체육관 · 관장</Text><Text testID={compact?'coach-live-line':undefined} style={[styles.line,compact&&styles.compactLine]}>{reaction.line}</Text>{!compact&&reaction.note?<Text style={styles.note}>{reaction.note}</Text>:null}</View>
 </View>;
}
const styles=StyleSheet.create({card:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:8},compactCard:{paddingVertical:0,backgroundColor:'#F5E5C3',borderRadius:8,paddingRight:10,borderWidth:2,borderColor:'#111B1E'},portrait:{width:104,height:125,flexShrink:0},compactPortrait:{width:68,height:66},copy:{flex:1,gap:4},label:{color:'#88734A',fontSize:11,fontWeight:'700'},line:{color:'#F8EBCF',fontSize:18,lineHeight:24,fontWeight:'900'},compactLine:{color:'#182D31',fontSize:13,lineHeight:18},note:{color:'#D0D9D1',fontSize:12,lineHeight:17}});
