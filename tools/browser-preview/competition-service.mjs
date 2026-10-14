import {randomUUID,createHash} from 'node:crypto';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {P0TenPunchSession} from '../../.preview-dist/app/session/P0TenPunchSession.js';
import {summarizeRound,compareRecords} from '../../.preview-dist/app/session/progression.js';
const sources={LEAD_JAB_HEAD:'144_13',REAR_STRAIGHT_HEAD:'144_20',LEAD_HOOK_HEAD:'14_01'};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export function createCompetitionService({file,now=Date.now}={}){
 const challenges=new Map();let entries=[],loaded=false,queue=Promise.resolve();
 async function load(){if(loaded)return;if(file){try{const value=JSON.parse(await readFile(file,'utf8'));if(!Array.isArray(value))throw Error('Invalid ranking data');entries=value;}catch(error){if(error.code!=='ENOENT')throw error;}}loaded=true;}
 async function save(){if(!file)return;await mkdir(dirname(file),{recursive:true});const temp=file+'.tmp';await writeFile(temp,JSON.stringify(entries));await rename(temp,file);}
 function standing(day,player){const board=entries.filter(e=>e.day===day),own=board.find(e=>e.player===player);if(!own)throw fail('No submitted record');const rank=1+board.filter(e=>compareRecords(e.record,own.record)<0).length;return {rank,participants:board.length,topPercent:board.length>=20?Math.ceil(board.filter(e=>compareRecords(e.record,own.record)<=0).length/board.length*100):null,day};}
 function start(player){const current=now();for(const [id,c] of challenges)if(current-c.started>15*60*1000)challenges.delete(id);if([...challenges.values()].filter(c=>c.player===player).length>=30)throw fail('Too many attempts; try later',429);if(challenges.size>=2000)throw fail('Try later',503);const day=new Date(current+9*3600*1000).toISOString().slice(0,10);const seed=createHash('sha256').update('boxing-survival-v1:'+day).digest().readUInt32LE(0);const c={id:randomUUID(),day,seed,level:2,leadInMs:2000,player,started:current};challenges.set(c.id,c);return {id:c.id,day,seed,level:2,leadInMs:2000};}
 function submit(player,id,inputs){const task=queue.then(async()=>{await load();const c=challenges.get(id);if(!c||c.player!==player||now()-c.started>15*60*1000)throw fail('Expired or invalid challenge',403);if(c.done)return standing(c.day,player);
 if(!Array.isArray(inputs)||inputs.length>600)throw fail('Invalid input list');let clock=0,previous=-1;const session=new P0TenPunchSession({nowMs:()=>clock},sources,{ruleset:'candidate',survivalLevel:2,maxHits:5,seed:c.seed});session.start({leadInMs:c.leadInMs});
 for(const event of inputs){if(!event||!Number.isFinite(event.atMs)||event.atMs<previous||event.atMs<0||event.atMs>120000||!['LEFT','RIGHT','BACK','GUARD'].includes(event.input))throw fail('Invalid input');previous=clock=event.atMs;if(session.tick().sessionCompleted)throw fail('Input after round ended');session.handleInput(event.input);}
 clock=120000;const snapshot=session.tick();const end=snapshot.latestResult.telemetry.impactScheduledAtMs;
 if(now()-c.started+150<end)throw fail('Round completed too soon');
 const record=summarizeRound(snapshot,2,1,now());const old=entries.find(e=>e.day===c.day&&e.player===player);if(!old||compareRecords(record,old.record)<0){const candidate=entries.filter(e=>!(e.day===c.day&&e.player===player));candidate.push({day:c.day,player,record});const before=entries;entries=candidate.filter(e=>e.day>=new Date(now()-7*86400000).toISOString().slice(0,10));try{await save();}catch(error){entries=before;throw error;}}
 c.done=true;return standing(c.day,player);});queue=task.catch(()=>{});return task;}
 function overview(player){const task=queue.then(async()=>{await load();const day=new Date(now()+9*3600*1000).toISOString().slice(0,10);const board=entries.filter(e=>e.day===day);return {day,participants:board.length,standing:board.some(e=>e.player===player)?standing(day,player):null};});queue=task.catch(()=>{});return task;}
 return {start,submit,overview};
}
export function competitionHandler(service){return async(req,res,url)=>{
 if(!url.pathname.startsWith('/api/challenge'))return false;
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{const reading=url.pathname==='/api/challenge/records';if(reading?req.method!=='GET':req.method!=='POST')throw fail('Method not allowed',405);if(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host&&req.headers.origin!=='https://'+req.headers.host)throw fail('Origin rejected',403);
 let player=/(?:^|;\s*)boxing_player=([a-f0-9-]{36})(?:;|$)/.exec(req.headers.cookie??'')?.[1];if(!player){player=randomUUID();res.setHeader('Set-Cookie','boxing_player='+player+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000');}
 if(reading){send(200,await service.overview(player));return true;}
 let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>65536)throw fail('Body too large',413);}let payload;try{payload=JSON.parse(body||'{}');}catch{throw fail('Invalid JSON');}
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw fail('Invalid JSON object');
 if(url.pathname==='/api/challenge')send(200,service.start(player));else {const id=url.pathname.slice('/api/challenge/'.length);send(200,await service.submit(player,id,payload.inputs));}
 }catch(error){send(error.status??500,{error:error.status?error.message:'Comparison service unavailable'});}return true;
};}
