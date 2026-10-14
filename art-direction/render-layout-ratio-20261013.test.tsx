import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {Svg, G, Image as SvgImage, Line} from 'react-native-svg';
import {writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {BoxerRig} from '../src/app/components/BoxerRig';
import {getFirstPersonFrame} from '../src/app/motion/firstPersonPresentation';

// Export the real component's SVG props for a desktop framing review.
// This is not a native rendering, full-screen layout or device-quality test.
const escape=(value:any)=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const kinds=new Map<any,string>([[Svg,'svg'],[G,'g'],[SvgImage,'image'],[Line,'line']]);
function serialize(node:any):string {
  if(typeof node==='string')return '';
  const tag=kinds.get(node.type);
  const children=()=>node.children.map(serialize).join('');
  if(!tag)return children();
  const keys=tag==='svg'?['width','height','viewBox','preserveAspectRatio']:tag==='g'?['transform']:tag==='image'?['x','y','width','height']:['x1','y1','x2','y2','stroke','strokeWidth'];
  const attrs=keys.filter(key=>node.props[key]!=null).map(key=>` ${key==='strokeWidth'?'stroke-width':key}="${escape(node.props[key])}"`).join('');
  const href=tag==='image'?` href="${escape(node.props.href.uri)}"`:'';
  return `<${tag}${attrs}${href}${tag==='svg'?' overflow="hidden"':''}>${children()}</${tag}>`;
}
it('exports measured arena frames from the current native component',()=>{
  const directory=join(__dirname,'layout-ratio-preview-20261013');
  mkdirSync(directory,{recursive:true});
  const panels:string[]=[];
  for(const [width,height] of [[320,240],[390,420],[430,650]])for(const guard of [0,1]) {
    const view=render(<BoxerRig frame={{guard} as ReturnType<typeof getFirstPersonFrame>}/>);
    fireEvent(screen.getByLabelText('상대 복서'),'layout',{nativeEvent:{layout:{width,height}}});
    const svgs=view.UNSAFE_getAllByType(Svg).filter(node=>['boxer-rig-svg','player-gloves-svg'].includes(node.props.testID));
    const file=`arena-${width}-${height}-guard-${guard}.svg`;
    writeFileSync(join(directory,file),`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#132433"/>${svgs.map(serialize).join('')}</svg>`);
    panels.push(`<figure><figcaption>${width}×${height} · ${guard?'가드':'대기'}</figcaption><img src="${file}"></figure>`);
    view.unmount();
  }
  writeFileSync(join(directory,'index.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><title>글러브 비율 확인</title><style>body{margin:20px;background:#10262b;color:#f8ebcf;font:16px sans-serif}main{display:grid;grid-template-columns:repeat(3,320px);gap:20px}figure{margin:0}figcaption{padding:10px}img{display:block;width:320px;border:2px solid #375363;border-radius:12px}</style><h1>동일 배율 · 글러브 1.25배</h1><p>현재 앱 컴포넌트의 SVG 좌표로 만든 데스크톱 검토 자료입니다. 실제 토스 기기 화면과 사운드는 별도 확인이 필요합니다.</p><main>${panels.join('')}</main></html>`);
});
