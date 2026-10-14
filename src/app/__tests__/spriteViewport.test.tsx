import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {G, Svg} from 'react-native-svg';
import {SpriteImage} from '../components/SpriteImage';
import {PlayerDefenseFeedback} from '../components/PlayerDefenseFeedback';
import {BoxerRig} from '../components/BoxerRig';
import {ART_ATLAS} from '../motion/artAtlas';
function position(node:any):[number,number]{
  let parent=node.parent;
  while(parent&&!parent.props.transform)parent=parent.parent;
  return parent.props.transform.match(/translate\(([^ ]+) ([^)]+)\)/).slice(1).map(Number);
}

it.each([400,420,650])('keeps resting fists in the lower field of view at scene height %s', viewportHeight=>{
  const resting=render(<Svg><PlayerDefenseFeedback guard={0} viewportHeight={viewportHeight}/></Svg>);
  for(const side of ['left','right']){
    const hand=resting.UNSAFE_getAllByType(Svg).find(node=>node.props.testID===`player-${side}-hand`)!;
    const [,y]=position(hand);
    const scale=hand.props.width/(ART_ATLAS.gloves.width/2);
    // Measured artwork landmarks: fist starts at row39, the blue glove
    // ends before row590. Keep that full glove below the attack sightline.
    expect(y+39*scale).toBeGreaterThanOrEqual(viewportHeight*.58);
    expect(y+590*scale).toBeLessThanOrEqual(viewportHeight-8);
  }
  resting.unmount();
  const raised=render(<Svg><PlayerDefenseFeedback guard={1} viewportHeight={viewportHeight}/></Svg>);
  for(const hand of raised.UNSAFE_getAllByType(Svg).filter(node=>/player-(left|right)-hand/.test(node.props.testID??''))){
    const [,y]=position(hand);
    const scale=hand.props.width/(ART_ATLAS.gloves.width/2);
    // During active guard the complete white cuff (through row820) fits.
    expect(y+820*scale).toBeLessThanOrEqual(viewportHeight);
    expect(y+39*scale).toBeLessThan(viewportHeight*.58);
  }
});

it('positions each cropped sprite in an isolated SVG group on the native renderer', () => {
  const {UNSAFE_getAllByType} = render(<Svg width={280} height={400}><SpriteImage source={{uri:'data:image/png;base64,test'}} width={1448} height={1086} columns={2} rows={1} index={1} x={148} y={205} displayWidth={128} displayHeight={195}/></Svg>);
  expect(UNSAFE_getAllByType(G).some(node => node.props.transform === 'translate(148 205)')).toBe(true);
  const crop = UNSAFE_getAllByType(Svg).find(node => node.props.viewBox === '724 0 724 1086');
  expect(crop?.props.x ?? 0).toBe(0);
  expect(crop?.props.y ?? 0).toBe(0);
});

it.each([0, .5, 1])('keeps one uniformly scaled hand, wrist and forearm at guard %s', guard => {
  const {UNSAFE_getAllByType} = render(<Svg><PlayerDefenseFeedback guard={guard}/></Svg>);
  const crops=UNSAFE_getAllByType(Svg);
  const left=crops.find(node=>node.props.testID==='player-left-hand')!;
  const right=crops.find(node=>node.props.testID==='player-right-hand')!;
  // Own hands remain on their respective sides instead of overlapping
  // across the sightline. Ready opponent head is centered at scene y=100.
  expect(position(left)[0]+left.props.width).toBeLessThanOrEqual(position(right)[0]);
  if(guard===1)expect(position(left)[1]).toBeGreaterThan(100);
  for(const side of ['left','right']){
    const hand=crops.find(node=>node.props.testID===`player-${side}-hand`)!;
    expect(hand).toBeDefined();
    expect(crops.find(node=>node.props.testID===`player-${side}-arm`)).toBeUndefined();
    const [,y]=position(hand);
    const cellWidth=ART_ATLAS.gloves.width/2;
    expect(hand.props.viewBox.split(' ').map(Number).slice(2)).toEqual([cellWidth,ART_ATLAS.gloves.height]);
    expect(hand.props.height/hand.props.width).toBeCloseTo(ART_ATLAS.gloves.height/cellWidth);
    // The one continuous forearm exits the screen; no split/stretch operation.
    expect(y+hand.props.height).toBeGreaterThanOrEqual(400);
    expect(hand.props.preserveAspectRatio).toBe('xMidYMid meet');
  }
});

it.each([
  [320,240], [390,420], [430,650],
])('uses the same pixel scale for both fighters in a %sx%s arena', (width,height) => {
  const view=render(<BoxerRig/>);
  fireEvent(screen.getByLabelText('상대 복서'),'layout',{nativeEvent:{layout:{width,height}}});
  const svgs=view.UNSAFE_getAllByType(Svg);
  const opponent=svgs.find(node=>node.props.testID==='boxer-rig-svg')!;
  const player=svgs.find(node=>node.props.testID==='player-gloves-svg')!;
  const expectedHeight=Math.max(400,280*height/width);
  const expectedWidth=expectedHeight*width/height;
  expect(opponent.props.viewBox).toBe(`${(280-expectedWidth)/2} 0 ${expectedWidth} ${expectedHeight}`);
  expect(player.props.viewBox).toBe(opponent.props.viewBox);
  expect(player.props.preserveAspectRatio).toBe(opponent.props.preserveAspectRatio);
  expect(opponent.props.preserveAspectRatio).toBe('xMidYMin meet');
  const gloves=svgs.filter(node=>/player-(left|right)-hand/.test(node.props.testID??''));
  expect(gloves).toHaveLength(2);
  for(const {props} of gloves) {
    expect(props.width).toBeGreaterThan(128);
    expect(props.width).toBeLessThanOrEqual(128*1.5);
    const crop=gloves.find(node=>node.props===props)!;
    const [x,y]=position(crop);
    expect(x).toBeGreaterThanOrEqual(0);expect(x+props.width).toBeLessThanOrEqual(280);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(props.viewBox.split(' ').map(Number)[3]).toBe(ART_ATLAS.gloves.height);
    expect(y+props.height).toBeGreaterThanOrEqual(expectedHeight);
    // Resting fists start below the opponent's face in even the shortest arena.
    expect(y+props.width*130/724).toBeGreaterThan(170);
  }
  fireEvent(screen.getByLabelText('상대 복서'),'layout',{nativeEvent:{layout:{width:0,height:0}}});
  expect(view.UNSAFE_getAllByType(Svg).find(node=>node.props.testID==='player-gloves-svg')!.props.viewBox).toBe(player.props.viewBox);
});
