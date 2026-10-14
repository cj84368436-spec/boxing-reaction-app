import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {Svg, G, Image as SvgImage, Line} from 'react-native-svg';
import {writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {BoxerRig} from '../src/app/components/BoxerRig';
import {getFirstPersonFrame} from '../src/app/motion/firstPersonPresentation';
import {ART_SOURCES} from '../src/app/assets/artSources';
import {P0_ATTACKS} from '../src/game/config/p0Attacks';
import {CHAMPION_UPPERCUT} from '../src/app/session/championRules';

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
  const sourceKey=tag==='image'?Object.entries(ART_SOURCES).find(([,value])=>value.uri===node.props.href.uri)?.[0]:undefined;
  if(tag==='image'&&!sourceKey)throw new Error('Unknown original artwork');
  const href=tag==='image'?` href="${escape(node.props.href.uri)}"`:'';
  return `<${tag}${attrs}${href}${tag==='svg'?' overflow="hidden"':''}>${children()}</${tag}>`;
}
it('exports measured arena frames from the current native component',()=>{
  const directory=join(__dirname,'full-audit-preview-20261013');
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
  writeFileSync(join(directory,'index.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><title>글러브 비율 확인</title><style>body{margin:20px;background:#10262b;color:#f8ebcf;font:16px sans-serif}main{display:grid;grid-template-columns:repeat(3,320px);gap:20px}figure{margin:0}figcaption{padding:10px}img{display:block;width:320px;border:2px solid #375363;border-radius:12px}</style><h1>손목 전체 표시 · 팔 연결 점검</h1><p>현재 앱 컴포넌트의 SVG 좌표로 만든 데스크톱 검토 자료입니다. 실제 토스 기기 화면과 사운드는 별도 확인이 필요합니다.</p><main>${panels.join('')}</main></html>`);
  const attacks:string[]=[];
  for(const attack of [...Object.values(P0_ATTACKS),CHAMPION_UPPERCUT]){
    for(const [phase,elapsedMs] of [['예고',attack.cueAnchorMs+1],['뻗기',attack.impactMs-1],['접촉',attack.impactMs],['회복',attack.impactMs+100]] as const){
      const view=render(<BoxerRig frame={{guard:0,attackId:attack.attackId,elapsedMs} as ReturnType<typeof getFirstPersonFrame>}/>);
      fireEvent(screen.getByLabelText('상대 복서'),'layout',{nativeEvent:{layout:{width:390,height:420}}});
      const svgs=view.UNSAFE_getAllByType(Svg).filter(node=>['boxer-rig-svg','player-gloves-svg'].includes(node.props.testID));
      const file=`attack-${attack.attackId}-${elapsedMs}.svg`;
      writeFileSync(join(directory,file),`<svg xmlns="http://www.w3.org/2000/svg" width="390" height="420" viewBox="0 0 390 420"><rect width="100%" height="100%" fill="#132433"/>${svgs.map(serialize).join('')}</svg>`);
      attacks.push(`<figure><figcaption>${attack.punchType} · ${phase}</figcaption><img src="${file}"></figure>`);view.unmount();
    }
  }
  writeFileSync(join(directory,'attacks.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><title>공격별 표시 점검</title><style>body{margin:20px;background:#10262b;color:#f8ebcf;font:16px sans-serif}main{display:grid;grid-template-columns:repeat(4,240px);gap:20px}figure{margin:0}figcaption{padding:10px}img{display:block;width:240px;border:2px solid #375363;border-radius:12px}</style><h1>네 공격 · 예고 / 뻗기 / 접촉 / 회복</h1><p>현재 컴포넌트와 원본 그림을 데스크톱에서 확인하는 자료입니다. 실제 게임의 기기 렌더링·타이밍 품질 검증은 아닙니다.</p><main>${attacks.join('')}</main></html>`);
});

