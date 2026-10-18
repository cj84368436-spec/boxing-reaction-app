import {buildShareResult} from '/.preview-dist/app/sharing/shareResult.js';
import {createResultShareAdapter} from '/.preview-dist/app/sharing/resultShareAdapter.js';
const qa=new URLSearchParams(location.search).get('qaShare')==='1';
let context,pending=false;
const button=document.getElementById('share-result-button'),note=document.getElementById('share-note');
const adapter=createResultShareAdapter({
 platform:()=>qa?'ios':'preview',
 getLink:async()=>{throw Error('Native link generation is not available in preview');},
 show:content=>new Promise((resolve,reject)=>{
  const box=document.createElement('div');box.id='qa-share';box.setAttribute('role','dialog');box.setAttribute('aria-label','공유 모의 검증');
  box.style.cssText='position:fixed;inset:12px;z-index:100;background:#10262b;padding:16px;overflow:auto;color:white';
  const heading=document.createElement('h2');heading.textContent='공유 모의 검증 · 실제 전송 없음';box.append(heading);
  const text=document.createElement('pre');text.id='qa-share-text';text.style.whiteSpace='pre-wrap';text.textContent=content.message;box.append(text);
  for(const [id,label,action] of [['cancel','취소','dismissedAction'],['complete','활동 완료 (모의)','sharedAction'],['fail','오류 (모의)',null]]){
   const b=document.createElement('button');b.id='qa-share-'+id;b.textContent=label;b.style.cssText='min-height:44px;margin:4px';
   b.onclick=()=>{box.remove();action?resolve({action}):reject(Error('Mock share failure'));};box.append(b);
  }
  document.body.append(box);
 }),
},{handoffDelayMs:0});
export function setPreviewShareContext(next){context=next;note.hidden=true;note.textContent='';}
button.addEventListener('click',async()=>{
 const ctx=context;if(!ctx||pending||adapter.busy||!ctx.isCurrent())return;
 const result=buildShareResult(ctx);if(!result)return;
 const data={roundId:ctx.roundId,difficulty:ctx.record.level,result_type:ctx.record.cleared?'clear':'knockout',survived:ctx.record.survived,perfect:ctx.record.perfect,is_personal_best:result.isPersonalBest,has_recent_comparison:ctx.comparison!=null,preview_mock:qa};
 pending=true;button.disabled=true;note.hidden=true;ctx.runtime.track('share_tap',data);
 try{
  const response=await adapter.share(result,()=>context===ctx&&ctx.isCurrent());
  if(response)ctx.runtime.track('share_outcome',{...data,outcome:response.outcome,has_link:response.hasLink});
  if(context===ctx&&(response?.outcome==='unsupported'||response?.outcome==='failed')){note.hidden=false;note.textContent=response.outcome==='unsupported'?'실제 공유는 토스 앱에서 이용할 수 있어요.':'공유창을 열지 못했어요. 다시 시도해 주세요.';}
 }finally{pending=false;button.disabled=false;}
});
