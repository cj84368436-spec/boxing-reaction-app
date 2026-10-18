import {entrySourceValue} from '../product/entrySource.js';
import type {EventLogParams} from '@apps-in-toss/framework';
import type {ProductEvent,ProductEventName} from '../product/productEvents.js';

type Params=Record<string,string|number|boolean>;
export interface AnalyticsContext {appVersion:string;roundId?:string;previousRoundId?:string;difficulty?:number;adAttemptId?:string}
const sentNames=new Set<ProductEventName>(['app_open','landing_view','tutorial_start','tutorial_complete','game_start','game_end','result_view','free_retry_tap','ad_retry_tap','retry_game_start','ad_start','ad_reward','ad_dismissed','ad_complete','ad_fail','share_tap','share_outcome']);
const sources=['landing','free_retry','ad_retry','next_level'];
const outcomes=['activity_completed','cancelled','sheet_open','failed','unsupported','unconfirmed','abandoned'];
const failures=['sdk','unsupported','show','load','show_timeout','reward_pending'];
/** Explicit allowlist: never spread journal data into a native payload. */
export function mapProductEvent(event:ProductEvent,context:AnalyticsContext):EventLogParams|null {
  if(!sentNames.has(event.name)||event.data.preview_mock===true)return null;
  const d=event.data,p:Params={app_version:context.appVersion,entry_source:entrySourceValue(d.entry_source)};
  const difficulty=d.difficulty??d.level??context.difficulty;
  if(difficulty===1||difficulty===2||difficulty===3)p.difficulty=difficulty;
  if(context.roundId)p.round_id=context.roundId;
  if(context.previousRoundId&&(event.name==='game_start'||event.name==='retry_game_start'))p.previous_round_id=context.previousRoundId;
  const choice=(key:string,value:unknown,allowed:readonly string[])=>{if(typeof value==='string'&&allowed.includes(value))p[key]=value;};
  const number=(key:string,max=30)=>{const n=d[key];if(typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<=max)p[key]=n;};
  const boolean=(key:string)=>{if(typeof d[key]==='boolean')p[key]=d[key] as boolean;};
  if(event.name==='game_start'||event.name==='retry_game_start'){
    choice('source',d.source,sources);
    p.is_retry=typeof d.previousRoundId==='string'&&(d.source==='free_retry'||d.source==='ad_retry');
    boolean('has_revisit_prompt');
    choice('revisit_prompt_kind',d.revisit_prompt_kind,['no_recent','below_best','equals_best','clear_below_best','clear_best','invalid']);
  }
  if(event.name==='game_end'){choice('reason',d.reason,['clear','knockout']);number('survived');number('perfect');}
  if(event.name==='result_view'){
    boolean('has_recent_comparison');p.comparison='none';choice('comparison',d.comparison,['improved','declined','same','mixed']);
    number('survived');number('perfect');boolean('is_personal_best');
  }
  if(event.name==='landing_view')boolean('has_revisit_prompt');
  if(event.name.startsWith('ad_')&&!event.name.endsWith('_tap')){
    choice('format',d.format,['rewarded','interstitial']);
    if(context.adAttemptId)p.ad_attempt_id=context.adAttemptId;
    if(event.name==='ad_fail')choice('failure_reason',d.reason,failures);
  }
  if(event.name==='share_tap'||event.name==='share_outcome'){
    choice('result_type',d.result_type,['clear','knockout']);number('survived');number('perfect');boolean('is_personal_best');boolean('has_recent_comparison');
    if(event.name==='share_outcome'){choice('outcome',d.outcome,outcomes);boolean('has_link');}
  }
  if(event.name.endsWith('_tap'))p.event_type='click';
  return {log_name:`boxing_${event.name}`,log_type:event.name==='landing_view'||event.name==='result_view'?'screen':'event',params:p};
}

export function createAppsAnalyticsAdapter(send:(payload:EventLogParams)=>void|Promise<void>,{appVersion,timeoutMs=5000}:{appVersion:string;timeoutMs?:number}) {
  let disposed=false,opened=false,landing:string|null=null,sequence=0,failed=0,attempted=0,dropped=0;
  // Ephemeral join tokens, never a persistent user/session ID; raw runtime IDs do not leave.
  const prefix=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;
  const rounds=new Map<string,{id:string;difficulty?:number}>(),ads=new Map<string,string>(),seen=new Set<string>();
  const pending=new Map<object,ReturnType<typeof setTimeout>>();
  const boundedSet=(key:string)=>{seen.add(key);if(seen.size>1024)seen.delete(seen.values().next().value!);};
  function round(raw:unknown,level?:unknown){
    if(typeof raw!=='string'||raw.length>180)return undefined;
    let r=rounds.get(raw);if(!r){r={id:`r-${prefix}-${++sequence}`};rounds.set(raw,r);if(rounds.size>256)rounds.delete(rounds.keys().next().value!);}
    if(level===1||level===2||level===3)r.difficulty=level;
    return r;
  }
  function record(event:ProductEvent):void {
    if(disposed||!sentNames.has(event.name)||event.data.preview_mock===true)return;
    try{
      const d=event.data,current=round(d.roundId,d.difficulty??d.level),previous=round(d.previousRoundId);
      let adAttemptId:string|undefined;
      if(typeof d.adRequestId==='string'&&d.adRequestId.length<=80){adAttemptId=ads.get(d.adRequestId);if(!adAttemptId){adAttemptId=`a-${prefix}-${++sequence}`;ads.set(d.adRequestId,adAttemptId);if(ads.size>256)ads.delete(ads.keys().next().value!);}}
      const context:AnalyticsContext={appVersion,...(current?{roundId:current.id,...(current.difficulty?{difficulty:current.difficulty}:{})}:{}),...(previous?{previousRoundId:previous.id}:{}),...(adAttemptId?{adAttemptId}:{})};
      const payload=mapProductEvent(event,context);if(!payload)return;
      if(event.name==='app_open'){if(opened)return;opened=true;}
      if(event.name==='landing_view'){const fingerprint=JSON.stringify(payload.params);if(landing===fingerprint)return;landing=fingerprint;}
      if(['game_start','tutorial_start','result_view'].includes(event.name))landing=null;
      let key:string|undefined;
      if(['game_start','game_end','result_view','retry_game_start'].includes(event.name)&&current)key=`${event.name}:${current.id}`;
      if(event.name.startsWith('ad_')&&adAttemptId)key=`${event.name}:${adAttemptId}`;
      if(key){if(seen.has(key))return;boundedSet(key);}
      if(pending.size>=32){dropped++;return;} // No custom queue; a stalled SDK cannot retain unlimited work.
      const operation={};attempted++;
      const finish=(failure:boolean)=>{const timer=pending.get(operation);if(timer===undefined)return;clearTimeout(timer);pending.delete(operation);if(failure)failed++;};
      pending.set(operation,setTimeout(()=>finish(true),timeoutMs));
      try{Promise.resolve(send(payload)).then(()=>finish(false),()=>finish(true));}catch{finish(true);}
    }catch{failed++;} // Mapping/transport diagnostics never enter the gameplay call stack.
  }
  return {record,diagnostics:()=>({attempted,failed,dropped,pending:pending.size}),dispose:()=>{disposed=true;for(const timer of pending.values())clearTimeout(timer);pending.clear();}};
}
