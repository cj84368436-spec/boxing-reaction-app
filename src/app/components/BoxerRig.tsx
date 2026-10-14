import React, {useState} from 'react';
import { StyleSheet, View } from 'react-native';
import { Svg, G, Line } from 'react-native-svg';
import { SpriteImage } from './SpriteImage';
import { ART_ATLAS } from '../motion/artAtlas';
import { ART_SOURCES } from '../assets/artSources';
import { selectSpriteFrame, selectSpriteSheet } from '../motion/cartoonSprites';
import { COMBAT_VIEW, type getFirstPersonFrame } from '../motion/firstPersonPresentation';
import type { SampledPose } from '../motion/types';
import { PlayerDefenseFeedback } from './PlayerDefenseFeedback';

const sheets=ART_SOURCES;
export function BoxerRig({pose,frame}:{readonly pose?:SampledPose;readonly frame?:ReturnType<typeof getFirstPersonFrame>}) {
  const [viewport,setViewport]=useState<{width:number;height:number}>({width:COMBAT_VIEW.width,height:COMBAT_VIEW.height});
  const viewportHeight=viewport.height;
  const viewBox=`${(COMBAT_VIEW.width-viewport.width)/2} 0 ${viewport.width} ${viewportHeight}`;
  const attackId=frame?.attackId ?? pose?.attackId ?? 'LEAD_JAB_HEAD';
  const index=selectSpriteFrame(attackId,frame?.elapsedMs ?? pose?.timeMs ?? 0);
  // One shared ready drawing prevents identity/scale jumps during quiet intervals.
  const sheet=selectSpriteSheet(attackId,index);
  const cel=index===5 || (sheet==='straight' && index===1) ? 0 : index;
  const lean=sheet==='straight' && index===1 ? -3 : 0;
  return <View accessible accessibilityRole="image" accessibilityLabel="상대 복서" pointerEvents="none" style={styles.viewport}
    onLayout={({nativeEvent:{layout:{width,height}}})=>{
      // Fit both fighters together on short arenas, keeping all original
      // world/camera coordinates and the same scale for both SVG layers.
      if(width>0 && height>0){
        const heightInScene=Math.max(COMBAT_VIEW.height,COMBAT_VIEW.width*height/width);
        setViewport({width:heightInScene*width/height,height:heightInScene});
      }
    }}>
    <Svg testID="boxer-rig-svg" width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="xMidYMin meet">
      <G testID="opponent-world" transform={`translate(${frame?.cameraX ?? 0} ${frame?.cameraY ?? 0}) translate(140 165) scale(${frame?.cameraScale ?? 1}) translate(-140 -165)`}>
        <G transform={`rotate(${lean} 140 300)`}><SpriteImage source={sheets[sheet]} {...ART_ATLAS[sheet]} index={cel} x={10} y={8} displayWidth={260} displayHeight={520}/></G>
      </G>
      {frame?.contact && (frame.hit || frame.guard>.5) ? <G>{Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return <Line key={i} x1={140+Math.cos(a)*42} y1={165+Math.sin(a)*42} x2={140+Math.cos(a)*61} y2={165+Math.sin(a)*61} stroke={frame.hit?'#FFE9CB':'#91C5FF'} strokeWidth={4}/>;})}</G>:null}
    </Svg>
    <Svg testID="player-gloves-svg" width="100%" height="100%" style={StyleSheet.absoluteFillObject}
      viewBox={viewBox} preserveAspectRatio="xMidYMin meet">
      <PlayerDefenseFeedback guard={frame?.guard ?? 0} viewportHeight={viewportHeight}/>
    </Svg>
  </View>;
}
const styles=StyleSheet.create({viewport:{width:'100%',height:'100%'}});
