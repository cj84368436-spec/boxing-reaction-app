import React from 'react';
import { G } from 'react-native-svg';
import { SpriteImage } from './SpriteImage';
import { ART_ATLAS } from '../motion/artAtlas';
import { ART_SOURCES } from '../assets/artSources';
const sheet=ART_ATLAS.gloves;
const gloveWidth=140;
const spriteHeight=sheet.height*gloveWidth/(sheet.width/sheet.columns);
// Keep the full blue glove and the start of its wrap visible at rest.
// The remaining wrist/forearm naturally continues below the viewport.
// Row610 is below the blue glove; moving the whole drawing keeps its shape.
const restingVisibleHeight=610*gloveWidth/(sheet.width/sheet.columns)+8;
export function PlayerDefenseFeedback({guard,viewportHeight=400}:{readonly guard:number;readonly viewportHeight?:number}) {
  const safe=Number.isFinite(guard)?Math.max(0,Math.min(1,guard)):0;
  const restingY=Math.max(0,viewportHeight-restingVisibleHeight);
  // Keep the raised fists below the ready head's eye cue (scene y=100).
  const guardY=Math.min(restingY,Math.max(110,viewportHeight-spriteHeight+8));
  const y=restingY+(guardY-restingY)*safe;
  return <G testID="player-gloves">
  <SpriteImage testID="player-left-hand" source={ART_SOURCES.gloves} {...sheet} index={0}
    x={0} y={y} displayWidth={gloveWidth} displayHeight={spriteHeight}/>
  <SpriteImage testID="player-right-hand" source={ART_SOURCES.gloves} {...sheet} index={1}
    x={140} y={y} displayWidth={gloveWidth} displayHeight={spriteHeight}/>
  </G>;
}
