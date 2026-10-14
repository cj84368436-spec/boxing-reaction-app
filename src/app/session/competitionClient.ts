import type {Level} from './survivalRules.js';
export interface Challenge {id:string;seed:number;level:Level;day:string;leadInMs:number}
export interface CompetitionInput {atMs:number;input:'LEFT'|'RIGHT'|'BACK'|'GUARD'}
export interface Standing {rank:number;participants:number;topPercent:number|null;day:string}
export interface CompetitionOverview {day:string;participants:number;standing:Standing|null}
async function request(url:string,options:RequestInit):Promise<any>{
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(Error('연결 시간이 초과되었습니다.'));controller.abort();},10000);});
 try{return await Promise.race([deadline,(async()=>{
   // DOM and React Native declare different AbortSignal types for the same API.
   const response=await fetch(url,{...options,signal:controller.signal as unknown as NonNullable<RequestInit['signal']>});
   if(!response.ok)throw Error('비교 서버 요청에 실패했습니다.');
   return await response.json();
 })()]);}finally{clearTimeout(timer);}
}
export async function readCompetition(base=''):Promise<CompetitionOverview>{
 const v=await request(base+'/api/challenge/records',{method:'GET',credentials:'include'});
 if(!v||typeof v.day!=='string'||!Number.isInteger(v.participants)||v.participants<0||!(v.standing===null||validStanding(v.standing)&&v.standing.participants===v.participants&&v.standing.day===v.day))throw Error('잘못된 기록 응답입니다.');
 return v;
}
function validStanding(v:Standing):boolean{return !!v&&Number.isInteger(v.rank)&&v.rank>=1&&Number.isInteger(v.participants)&&v.participants>=v.rank&&typeof v.day==='string'&&(v.topPercent===null||Number.isInteger(v.topPercent)&&v.topPercent>=1&&v.topPercent<=100);}
export function overviewText(v:CompetitionOverview):string{return v.day+' · '+(v.standing?standingText(v.standing):'아직 오늘의 참가 기록이 없습니다. · 참가 기록 '+v.participants+'개');}
export async function startChallenge(base=''):Promise<Challenge>{const value:any=await request(base+'/api/challenge',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:'{}'});if(!value||typeof value.id!=='string'||!Number.isInteger(value.seed)||value.level!==2||typeof value.day!=='string'||!Number.isFinite(value.leadInMs)||value.leadInMs<0)throw Error('잘못된 코스 응답입니다.');return value as Challenge;}
export async function submitChallenge(challenge:Challenge,inputs:readonly CompetitionInput[],base=''):Promise<Standing>{const value:any=await request(base+'/api/challenge/'+challenge.id,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({inputs})});if(!value||!Number.isInteger(value.rank)||value.rank<1||!Number.isInteger(value.participants)||value.participants<value.rank||typeof value.day!=='string'||!(value.topPercent===null||Number.isInteger(value.topPercent)&&value.topPercent>=1&&value.topPercent<=100))throw Error('잘못된 순위 응답입니다.');return value as Standing;}
export function standingText(s:Standing):string{return s.participants<2?'오늘의 첫 참가 기록 · 비교 상대 대기':s.participants+'개 참가 기록 중 '+s.rank+'위'+(s.topPercent==null?' · 표본 수집 중':' · 상위 '+s.topPercent+'%');}
