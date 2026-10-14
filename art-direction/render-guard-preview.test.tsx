import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {Svg,G,Image as SvgImage,Line} from 'react-native-svg';
import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {BoxerRig} from '../src/app/components/BoxerRig';

const escape=(value:unknown)=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const tags=new Map<any,string>([[Svg,'svg'],[G,'g'],[SvgImage,'image'],[Line,'line']]);
function svg(element:any):string {
  if(element==null || element===false)return '';
  if(Array.isArray(element))return element.map(svg).join('');
  if(!React.isValidElement(element))return '';
  const {type,props}=element as any;
  const tag=tags.get(type);
  if(!tag){
    if(typeof type==='function')return svg(type(props));
    throw Error('Unsupported component in actual SVG preview');
  }
  const attributes=Object.entries(props).filter(([key])=>!['children','style','testID'].includes(key)).map(([key,value])=>{
    const name=key==='strokeWidth'?'stroke-width':key;
    const attribute=key==='href'?(value as any).uri:value;
    return `${name}="${escape(attribute)}"`;
  });
  if(tag==='svg')attributes.push('overflow="hidden"');
  return `<${tag} ${attributes.join(' ')}>${svg(props.children)}</${tag}>`;
}

it('exports the current native SVG components as a desktop guard contact sheet',()=>{
  const directory=join(__dirname,'guard-reference-preview-20261014');
  mkdirSync(directory,{recursive:true});
  const figures:string[]=[];
  for(const [width,height] of [[320,240],[390,420],[430,650]])for(const guard of [0,.5,1]){
    const view=render(<BoxerRig frame={{attackId:'LEAD_JAB_HEAD',elapsedMs:0,guard,cameraX:0,cameraY:0,cameraScale:1} as any}/>);
    fireEvent(view.getByLabelText('상대 복서'),'layout',{nativeEvent:{layout:{width,height}}});
    const layers=view.UNSAFE_getAllByType(Svg).filter(node=>['boxer-rig-svg','player-gloves-svg'].includes(node.props.testID));
    expect(layers).toHaveLength(2);
    const drawing=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#132433"/>${layers.map(node=>svg(React.createElement(Svg,node.props))).join('')}</svg>`;
    const file=`arena-${width}-${height}-guard-${guard}.svg`;
    writeFileSync(join(directory,file),drawing);
    figures.push(`<figure><figcaption>${width}×${height} · ${guard===0?'대기':guard===1?'하이 가드':'중간 동작'}</figcaption><img src="${file}"></figure>`);
    view.unmount();
  }
  writeFileSync(join(directory,'index.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><title>하이 가드 1인칭 확인</title><style>body{margin:20px;background:#10262b;color:#f8ebcf;font:16px sans-serif}main{display:grid;grid-template-columns:repeat(3,300px);gap:18px}figure{margin:0}figcaption{padding:10px}img{display:block;width:300px;border:2px solid #375363;border-radius:12px}</style><h1>1인칭 가드 · 손바닥 방향 · 손목 일체 표시</h1><p>현재 앱 SVG 컴포넌트의 데스크톱 그림 검토 자료입니다. 실제 토스 앱 화면·광고·소리 검증은 별도입니다.</p><main>${figures.join('')}</main></html>`);
});
