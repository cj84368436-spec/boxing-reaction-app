import React from 'react';
import { Svg, G, Image as SvgImage } from 'react-native-svg';

type SheetSource = React.ComponentProps<typeof SvgImage>['href'];
/** Nested viewBox crops a registered cel without modifying the generated source image. */
export function SpriteImage({ source, width, height, columns, rows, index, x=0, y=0, displayWidth, displayHeight, testID }: {
  readonly source: SheetSource; readonly width:number; readonly height:number;
  readonly columns:number; readonly rows:number; readonly index:number;
  readonly x?:number; readonly y?:number; readonly displayWidth:number; readonly displayHeight:number;
  readonly testID?:string;
}) {
  const cellWidth=width/columns, cellHeight=height/rows;
  const safe=Math.max(0,Math.min(columns*rows-1,Math.floor(index)));
  // Native nested Svg clips at (0, 0) and does not apply x/y. Isolate its
  // clip and position in a group so one cel cannot clip its sibling.
  return <G transform={`translate(${x} ${y})`}><Svg testID={testID} width={displayWidth} height={displayHeight}
    viewBox={`${(safe%columns)*cellWidth} ${Math.floor(safe/columns)*cellHeight} ${cellWidth} ${cellHeight}`}
    preserveAspectRatio="xMidYMid meet" style={{overflow:"hidden"}}>
    <SvgImage href={source} x={0} y={0} width={width} height={height} />
  </Svg></G>;
}
