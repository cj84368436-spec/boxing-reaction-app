import type { TenPunchSessionSnapshot } from './P0TenPunchSession.js';
import type { Level } from './survivalRules.js';
import {isCompletedRecentRecord} from '../product/recentRecords.js';
export interface RoundRecord {level:Level;cleared:boolean;resolved:number;survived:number;lives:number;perfect:number;streak:number;reactionMs:number|null;at:number}
export interface Progress {version:1;unlocked:Level;best:Partial<Record<Level,RoundRecord>>;bestStreak:Partial<Record<Level,number>>;recentByDifficulty?:Partial<Record<Level,RoundRecord>>}
export const emptyProgress=():Progress=>({version:1,unlocked:1,best:{},bestStreak:{}});
export function summarizeRound(s:TenPunchSessionSnapshot,level:Level,rate:number,at=Date.now()):RoundRecord {
 let streak=0,best=0;const reactions:number[]=[];let perfect=0;
 for(const r of s.results){if(r.outcome==='PERFECT'){perfect++;streak++;best=Math.max(best,streak);if(r.telemetry.reactionMs!=null && r.telemetry.reactionMs>=0)reactions.push(r.telemetry.reactionMs/rate);}else streak=0;}
 return {level,cleared:s.sessionCompleted&&!s.knockedOut,resolved:s.results.length,survived:s.results.length-(s.knockedOut?1:0),lives:s.livesRemaining??0,perfect,streak:best,reactionMs:reactions.length?Math.round(reactions.reduce((a,b)=>a+b,0)/reactions.length):null,at};
}
/** Negative means a ranks ahead. Ties stay tied; timestamps are never a skill metric. */
export function compareRecords(a:RoundRecord,b:RoundRecord):number {
 for(const key of ['cleared','survived','lives','perfect'] as const){const delta=Number(b[key])-Number(a[key]);if(delta)return delta;}
 return (a.reactionMs??Infinity)-(b.reactionMs??Infinity)||0;
}
export function earnsPromotion(r:RoundRecord):boolean{return r.cleared && r.resolved===30 && r.lives>0;}
export function isHighScore(r:RoundRecord):boolean{return earnsPromotion(r)&&r.perfect>=24&&r.lives>=3;}
export function recordRound(p:Progress,r:RoundRecord):Progress {
 const old=p.best[r.level];const next=earnsPromotion(r)?Math.min(3,r.level+1) as Level:p.unlocked;
 return {version:1,unlocked:Math.max(p.unlocked,next) as Level,best:{...p.best,[r.level]:!old||compareRecords(r,old)<0?r:old},bestStreak:{...p.bestStreak,[r.level]:Math.max(p.bestStreak[r.level]??0,r.streak)},...(p.recentByDifficulty?{recentByDifficulty:p.recentByDifficulty}:{})};
}
export interface ProgressParseResult {progress:Progress;damaged:boolean}
function isRoundRecord(value:unknown,level:Level):value is RoundRecord {
 const r=value as Record<string,unknown>|null;
 return r!=null&&r.level===level&&typeof r.cleared==='boolean'&&
  ['resolved','survived','lives','perfect','streak','at'].every(k=>Number.isFinite(r[k])&&(r[k] as number)>=0)&&
  (r.resolved as number)<=30&&(r.survived as number)<=30&&(r.lives as number)<=5&&
  (r.perfect as number)<=30&&(r.streak as number)<=30&&
  (r.reactionMs===null||Number.isFinite(r.reactionMs)&&(r.reactionMs as number)>=0);
}
export function parseProgressWithStatus(raw:string|null):ProgressParseResult {
 if(raw===null)return {progress:emptyProgress(),damaged:false};
 try{
  const p=JSON.parse(raw) as Record<string,any>|null;
  if(p===null||typeof p!=='object'||p.version!==1)return {progress:emptyProgress(),damaged:true};
  const out=emptyProgress();let damaged=false;
  if([1,2,3].includes(p.unlocked))out.unlocked=p.unlocked as Level;else damaged=true;
  if(p.best!=null&&typeof p.best!=='object')damaged=true;
  if(p.bestStreak!=null&&typeof p.bestStreak!=='object')damaged=true;
  if(p.recentByDifficulty!==undefined){
   if(p.recentByDifficulty===null||typeof p.recentByDifficulty!=='object'||Array.isArray(p.recentByDifficulty))damaged=true;
   else {
    out.recentByDifficulty={};
    for(const level of [1,2,3] as const){
     const recent=p.recentByDifficulty[level];
     if(recent===undefined)continue;
     if(isCompletedRecentRecord(recent,level))out.recentByDifficulty[level]=recent;
     else damaged=true;
    }
   }
  }
  for(const level of [1,2,3] as const){
   const record=p.best?.[level];
   if(record==null)continue;
   if(!isRoundRecord(record,level)){damaged=true;continue;}
   out.best[level]=record;
   const storedStreak=p.bestStreak?.[level];
   if(storedStreak!=null&&(!Number.isFinite(storedStreak)||storedStreak<0))damaged=true;
   out.bestStreak[level]=Math.min(30,Math.max(record.streak,Number.isFinite(storedStreak)?storedStreak:0));
  }
  for(const level of [1,2] as const){const record=out.best[level];if(record&&earnsPromotion(record))out.unlocked=Math.max(out.unlocked,level+1) as Level;}
  return {progress:out,damaged};
 }catch{return {progress:emptyProgress(),damaged:true};}
}
export function parseProgress(raw:string|null):Progress{return parseProgressWithStatus(raw).progress;}
export function recordText(r:RoundRecord|undefined):string{return r? (r.cleared?'클리어 · 목숨 '+r.lives:'최고 생존 '+r.survived+'/30')+' · 완벽 '+r.perfect:'아직 기록 없음';}
