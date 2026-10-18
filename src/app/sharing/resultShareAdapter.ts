import type {ShareResult} from './shareResult.js';

export type ShareOutcome='activity_completed'|'cancelled'|'sheet_open'|'failed'|'unsupported'|'unconfirmed'|'abandoned';
export interface ShareResponse {outcome:ShareOutcome;hasLink:boolean}
interface SharePort {
  platform:()=>string;
  getLink:()=>Promise<string>;
  show:(content:{title:string;message:string})=>Promise<{action:string}>;
}
export interface ResultShareAdapter {
  readonly busy:boolean;
  share:(result:ShareResult,isCurrent:()=>boolean)=>Promise<ShareResponse|null>;
}
/** A singleton adapter owns the request across screen remounts. No ad/lifecycle state. */
export function createResultShareAdapter(port:SharePort,{linkTimeoutMs=1500,handoffDelayMs=1000}={}):ResultShareAdapter {
  let busy=false;
  async function optionalLink():Promise<string|undefined>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    try {
      const value=await Promise.race([Promise.resolve().then(()=>port.getLink()),new Promise<undefined>(resolve=>{timer=setTimeout(()=>resolve(undefined),linkTimeoutMs);})]);
      return value&&new URL(value).protocol==='https:'?value:undefined;
    }catch{return undefined;}finally{if(timer!==undefined)clearTimeout(timer);}
  }
  return {
    get busy(){return busy;},
    async share(result,isCurrent){
      if(busy)return null;
      busy=true;let hasLink=false;
      try {
        const os=port.platform();
        if(os!=='ios'&&os!=='android')return {outcome:'unsupported',hasLink};
        const link=await optionalLink();hasLink=link!==undefined;
        if(!isCurrent())return {outcome:'abandoned',hasLink};
        const response=await port.show({title:result.title,message:result.text+(link?'\n'+link:'')});
        // Android resolves when starting its chooser, not when it closes. Absorb rapid taps
        // during that handoff; the OS modal then owns input. Do not invent a cancel callback.
        if(os==='android'&&handoffDelayMs>0)await new Promise(resolve=>setTimeout(resolve,handoffDelayMs));
        const outcome:ShareOutcome=os==='ios'
          ? response.action==='sharedAction'?'activity_completed':response.action==='dismissedAction'?'cancelled':'unconfirmed'
          : response.action==='sharedAction'?'sheet_open':'unconfirmed';
        return {outcome,hasLink};
      }catch{return {outcome:'failed',hasLink};}
      finally{busy=false;}
    },
  };
}
